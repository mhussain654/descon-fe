import { useCallback, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../../contexts/AuthContext';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { toast } from '../../../../design-system';
import { candidateDocumentsClient } from '../../../../lib/candidate-documents-client';
import type { CandidateDocumentChecklistItem, CandidateDocumentsError } from '../../../../lib/candidate-documents-client';
import {
  clearIdempotencyKey,
  EMPTY_IDEMPOTENCY_KEY_STATE,
  randomIdempotencyKey,
  resolveIdempotencyKey,
  type IdempotencyKeyState,
} from '../../../../../../shared/candidateDocuments/idempotency';
import {
  appendEntries,
  layoutFor,
  orderedEntries,
  replaceSlot,
  validateFileSet,
  type FileSetEntry,
  type FileSetLayout,
  type FileSetValidationError,
  type PairUploadMode,
} from '../../../../../../shared/candidateDocuments/fileSet';
import { PCC_REQUIREMENT_CODE, validatePccIssueDate, type PccIssueDateError } from '../../../../../../shared/candidateDocuments/pccIssueDate';
import type { DocumentSideCode, DocumentUploadRules } from '../../../../../../shared/candidateDocuments/types';
import { documentQueries } from '../../../../../../shared/queryKeys/documentQueries';

interface UploadVariables {
  requirementCode: string;
  entries: FileSetEntry<File>[];
  issuedOn: string;
  idempotencyKey: string;
  /** Captured at the moment `mutate()` is called -- lets onSuccess skip touching the cache if the candidate logged out (or another candidate signed in) since this request started. */
  accessTokenAtCallTime: string;
}

/**
 * Identifies the whole file set (each file, its part label and order) plus
 * the PCC issue date, matching what the backend's own idempotency fingerprint
 * covers -- any change starts a fresh attempt with a new key.
 */
function fileSetSignature(entries: FileSetEntry<File>[], issuedOn: string): string {
  const files = entries.map(({ sideCode, file }) => `${sideCode ?? '-'}:${file.name}:${file.size}:${file.lastModified}`);
  return `${files.join('|')}#${issuedOn}`;
}

/**
 * Sends the file set as `files[]` (each a file plus its part label, when the
 * requirement uses labels). `issued_on` is only sent for the PCC requirement;
 * `expires_on` is never sent -- the backend always calculates it.
 */
function buildFormData(requirementCode: string, entries: FileSetEntry<File>[], issuedOn: string): FormData {
  const formData = new FormData();
  formData.append('candidate_document[requirement_code]', requirementCode);
  for (const { sideCode, file } of entries) {
    formData.append('candidate_document[files][][file]', file);
    if (sideCode) formData.append('candidate_document[files][][side_code]', sideCode);
  }
  if (requirementCode === PCC_REQUIREMENT_CODE && issuedOn.trim()) {
    formData.append('candidate_document[issued_on]', issuedOn.trim());
  }
  return formData;
}

interface ActiveRequirement {
  requirementCode: string;
  rules: DocumentUploadRules;
}

/**
 * Owns the single active "upload or replace" flow across the whole
 * checklist: which requirement is being acted on, the selected file set
 * (shaped by that requirement's backend rules -- see shared/candidateDocuments/fileSet.ts),
 * its validation, the idempotency key and the upload mutation. Only one
 * requirement can be active at a time; the checklist disables other rows'
 * actions while `mutation.isPending`.
 */
export function useDocumentUpload() {
  const { session } = useAuth();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const candidateId = session?.candidateId ?? 'anonymous';

  const [active, setActive] = useState<ActiveRequirement | null>(null);
  const [mode, setModeState] = useState<PairUploadMode>('parts');
  const [entries, setEntries] = useState<FileSetEntry<File>[]>([]);
  // Set-level problems (e.g. a missing back side) are only shown once the
  // candidate tries to submit -- not while they're still choosing files.
  const [showSetError, setShowSetError] = useState(false);
  const [issuedOn, setIssuedOnState] = useState('');
  const [issuedOnError, setIssuedOnError] = useState<PccIssueDateError | null>(null);
  const [idempotencyState, setIdempotencyState] = useState<IdempotencyKeyState>(EMPTY_IDEMPOTENCY_KEY_STATE);

  // A response for an item the candidate has since navigated away from must
  // not clear *that new* selection's local state.
  const activeRequirementCodeRef = useRef<string | null>(null);
  activeRequirementCodeRef.current = active?.requirementCode ?? null;

  const layout: FileSetLayout | null = useMemo(() => (active ? layoutFor(active.rules) : null), [active]);
  const validation: FileSetValidationError | null = useMemo(
    () => (active ? validateFileSet(active.rules, entries) : null),
    [active, entries]
  );
  const isPccRequirement = active?.requirementCode === PCC_REQUIREMENT_CODE;

  const resetSelection = useCallback(() => {
    setEntries([]);
    setShowSetError(false);
    setIssuedOnState('');
    setIssuedOnError(null);
    setIdempotencyState(EMPTY_IDEMPOTENCY_KEY_STATE);
  }, []);

  const mutation = useMutation<CandidateDocumentChecklistItem, CandidateDocumentsError, UploadVariables>({
    mutationFn: ({ requirementCode, entries: files, issuedOn: date, idempotencyKey, accessTokenAtCallTime }) =>
      candidateDocumentsClient.uploadDocument({
        accessToken: accessTokenAtCallTime,
        requirementCode,
        formData: buildFormData(requirementCode, files, date),
        idempotencyKey,
      }),
    onSuccess: (result, variables) => {
      if (session?.accessToken !== variables.accessTokenAtCallTime) return;

      queryClient.setQueryData<CandidateDocumentChecklistItem[]>(documentQueries.candidateChecklist(candidateId, language), (old) =>
        old ? old.map((item) => (item.requirementCode === result.requirementCode ? result : item)) : old
      );
      // Counts, submission state and the next action on Dashboard/Status/
      // Profile all come from application progress -- refresh it too.
      queryClient.invalidateQueries({ queryKey: documentQueries.applicationProgress(candidateId, language) });
      toast.success(t('candidateDocumentsUploadSuccessToast'));

      if (activeRequirementCodeRef.current === result.requirementCode) {
        setActive(null);
        resetSelection();
        setIdempotencyState(clearIdempotencyKey());
      }
    },
    onError: (error) => {
      // A consumed/conflicting key or a now-forbidden replacement must never
      // be replayed: the next submit mints a fresh key.
      if (error.code === 'CONFLICT' || error.code === 'REPLACEMENT_NOT_ALLOWED') {
        setIdempotencyState(EMPTY_IDEMPOTENCY_KEY_STATE);
      }
      if (error.code === 'REPLACEMENT_NOT_ALLOWED') {
        queryClient.invalidateQueries({ queryKey: documentQueries.candidateChecklist(candidateId, language) });
      }
    },
  });

  const startUpload = useCallback(
    (item: Pick<CandidateDocumentChecklistItem, 'requirementCode' | 'uploadRules'>) => {
      setActive({ requirementCode: item.requirementCode, rules: item.uploadRules });
      setModeState('parts');
      resetSelection();
      mutation.reset();
    },
    [mutation, resetSelection]
  );

  const cancelUpload = useCallback(() => {
    setActive(null);
    resetSelection();
    mutation.reset();
  }, [mutation, resetSelection]);

  /** Switching between one combined PDF and separate parts starts the selection over. */
  const setMode = useCallback(
    (nextMode: PairUploadMode) => {
      setModeState(nextMode);
      setEntries([]);
      setShowSetError(false);
      mutation.reset();
    },
    [mutation]
  );

  /** Fills (or, with null, empties) one slot: a pair part, the combined PDF, or the single file. */
  const selectSlotFile = useCallback(
    (sideCode: DocumentSideCode | null, file: File | null) => {
      setEntries((current) => replaceSlot(current, sideCode, file));
      mutation.reset();
    },
    [mutation]
  );

  /** Adds files to a repeatable document (several certificates). */
  const addFiles = useCallback(
    (files: File[]) => {
      if (!layout || layout.kind !== 'multiple') return;
      setEntries((current) => appendEntries(current, layout.sideCode, files, layout.maximumFiles));
      mutation.reset();
    },
    [layout, mutation]
  );

  const removeFileAt = useCallback(
    (index: number) => {
      setEntries((current) => current.filter((_, position) => position !== index));
      mutation.reset();
    },
    [mutation]
  );

  const setIssuedOn = useCallback((value: string) => {
    setIssuedOnState(value);
    setIssuedOnError(null);
  }, []);

  const submit = useCallback(() => {
    if (!active || !layout || !session || mutation.isPending) return;
    setShowSetError(true);
    if (validation) return;

    if (isPccRequirement) {
      const dateError = validatePccIssueDate(issuedOn);
      setIssuedOnError(dateError);
      if (dateError) return;
    }

    const files = orderedEntries(layout, entries);
    // Reused for an unchanged retry; minted fresh for any change to the set,
    // the requirement or the issue date.
    const resolved = resolveIdempotencyKey(
      idempotencyState,
      { requirementCode: active.requirementCode, fileSignature: fileSetSignature(files, issuedOn) },
      randomIdempotencyKey
    );
    setIdempotencyState(resolved);

    mutation.mutate({
      requirementCode: active.requirementCode,
      entries: files,
      issuedOn,
      idempotencyKey: resolved.key as string,
      accessTokenAtCallTime: session.accessToken,
    });
  }, [active, layout, session, mutation, validation, isPccRequirement, issuedOn, entries, idempotencyState]);

  return {
    activeRequirementCode: active?.requirementCode ?? null,
    rules: active?.rules ?? null,
    layout,
    mode,
    setMode,
    entries,
    validation,
    showSetError,
    isPccRequirement,
    issuedOn,
    setIssuedOn,
    issuedOnError,
    startUpload,
    cancelUpload,
    selectSlotFile,
    addFiles,
    removeFileAt,
    submit,
    /** Retry reuses the same key, since nothing about the selection changed. */
    retry: submit,
    mutation,
  };
}

export type DocumentUploadController = ReturnType<typeof useDocumentUpload>;

import { useCallback, useRef, useState } from 'react';
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
import { validateSelectedFile, type FileValidationError } from '../../../../../../shared/candidateDocuments/fileValidation';
import { documentQueries } from '../../../../../../shared/queryKeys/documentQueries';

interface UploadVariables {
  requirementCode: string;
  file: File;
  idempotencyKey: string;
  /** Captured at the moment `mutate()` is called, not read reactively when the request resolves -- lets onSuccess detect "the candidate logged out (or a different candidate is now signed in) since this request started" and skip touching the cache (ticket: "A completed upload must not update candidate data after logout" / "Do not leak one candidate's checklist into another candidate's session."). */
  accessTokenAtCallTime: string;
}

function fileSignature(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

/**
 * Owns the single active "upload or replace" flow across the whole
 * checklist: which requirement is being acted on, the selected file, its
 * validation, the idempotency key, and the upload mutation itself. Only one
 * requirement can be active at a time (ticket: "Prevent concurrent uploads
 * for the same requirement" / "Switching requirements must invalidate the
 * previous local selection state") -- the checklist view is responsible for
 * disabling other rows' actions while `mutation.isPending`.
 */
export function useDocumentUpload() {
  const { session } = useAuth();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const candidateId = session?.candidateId ?? 'anonymous';

  const [activeRequirementCode, setActiveRequirementCode] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<FileValidationError | null>(null);
  const [idempotencyState, setIdempotencyState] = useState<IdempotencyKeyState>(EMPTY_IDEMPOTENCY_KEY_STATE);

  // A response for an item the candidate has since navigated away from
  // (by opening a different requirement's uploader) must not clear *that
  // new* selection's local state -- only the query cache update applies
  // unconditionally (it's keyed by the response's own requirementCode, so
  // it's race-safe regardless of what's currently active).
  const activeRequirementCodeRef = useRef<string | null>(null);
  activeRequirementCodeRef.current = activeRequirementCode;

  const mutation = useMutation<CandidateDocumentChecklistItem, CandidateDocumentsError, UploadVariables>({
    mutationFn: ({ requirementCode, file, idempotencyKey, accessTokenAtCallTime }) => {
      const formData = new FormData();
      formData.append('candidate_document[requirement_code]', requirementCode);
      formData.append('candidate_document[file]', file);
      return candidateDocumentsClient.uploadDocument({
        accessToken: accessTokenAtCallTime,
        requirementCode,
        formData,
        idempotencyKey,
      });
    },
    onSuccess: (result, variables) => {
      if (session?.accessToken !== variables.accessTokenAtCallTime) return;

      queryClient.setQueryData<CandidateDocumentChecklistItem[]>(documentQueries.candidateChecklist(candidateId, language), (old) =>
        old ? old.map((item) => (item.requirementCode === result.requirementCode ? result : item)) : old
      );
      toast.success(t('candidateDocumentsUploadSuccessToast'));

      // Collapse the panel back to the row's normal display -- the
      // checklist item itself (now updated above) is the "success" state;
      // leaving the panel open would just silently relabel its own
      // Upload/Replace heading with no clear signal that anything happened.
      if (activeRequirementCodeRef.current === result.requirementCode) {
        setActiveRequirementCode(null);
        setFile(null);
        setValidationError(null);
        setIdempotencyState(clearIdempotencyKey());
      }
    },
    onError: (error) => {
      // A conflict means this exact key was already consumed by a
      // different (or already-processing) request -- reusing it again
      // would just conflict again, so force the *next* submit (even for
      // the identical file) to mint a fresh key rather than silently
      // replaying the same doomed attempt (ticket: "Do not automatically
      // retry ... idempotency conflicts" / "allow the user to select the
      // file again, which should create a new key").
      //
      // A forbidden replacement means the item's eligibility may have
      // changed since the checklist was loaded -- refetch it so the row
      // reflects the current `replacement_allowed` (and hide its Replace
      // action if it's now false), and likewise never let a retry reuse
      // the same now-rejected key (ticket: "Do not keep retrying
      // automatically. Refresh the checklist... Hide the replace action if
      // the refreshed item disallows replacement.").
      if (error.code === 'CONFLICT' || error.code === 'REPLACEMENT_NOT_ALLOWED') {
        setIdempotencyState(EMPTY_IDEMPOTENCY_KEY_STATE);
      }
      if (error.code === 'REPLACEMENT_NOT_ALLOWED') {
        queryClient.invalidateQueries({ queryKey: documentQueries.candidateChecklist(candidateId, language) });
      }
    },
  });

  const startUpload = useCallback(
    (requirementCode: string) => {
      setActiveRequirementCode(requirementCode);
      setFile(null);
      setValidationError(null);
      setIdempotencyState(EMPTY_IDEMPOTENCY_KEY_STATE);
      mutation.reset();
    },
    [mutation]
  );

  const cancelUpload = useCallback(() => {
    setActiveRequirementCode(null);
    setFile(null);
    setValidationError(null);
    setIdempotencyState(EMPTY_IDEMPOTENCY_KEY_STATE);
    mutation.reset();
  }, [mutation]);

  const selectFile = useCallback(
    (nextFile: File | null) => {
      if (!activeRequirementCode) return;
      setFile(nextFile);
      setValidationError(
        validateSelectedFile(nextFile ? { name: nextFile.name, size: nextFile.size, type: nextFile.type } : null)
      );
      mutation.reset();
    },
    [activeRequirementCode, mutation]
  );

  const submit = useCallback(() => {
    if (!file || !activeRequirementCode || !session || mutation.isPending) return;
    const error = validateSelectedFile({ name: file.name, size: file.size, type: file.type });
    setValidationError(error);
    if (error) return;

    // Resolved synchronously (not via a setState updater) so the freshly
    // decided key is available immediately for this same call -- reused
    // when the file/requirement are unchanged from the last attempt
    // (a retry), minted fresh otherwise (a new file, a new requirement, or
    // a key onError already cleared after a conflict/forbidden replacement).
    const resolved = resolveIdempotencyKey(
      idempotencyState,
      { requirementCode: activeRequirementCode, fileSignature: fileSignature(file) },
      randomIdempotencyKey
    );
    setIdempotencyState(resolved);

    mutation.mutate({
      requirementCode: activeRequirementCode,
      file,
      idempotencyKey: resolved.key as string,
      accessTokenAtCallTime: session.accessToken,
    });
  }, [file, activeRequirementCode, session, idempotencyState, mutation]);

  return {
    activeRequirementCode,
    file,
    validationError,
    startUpload,
    cancelUpload,
    selectFile,
    submit,
    /** Retry reuses the exact same call -- resolveIdempotencyKey already kept the same key since neither the file nor the requirement changed. */
    retry: submit,
    mutation,
  };
}

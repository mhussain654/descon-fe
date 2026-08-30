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
import { PCC_REQUIREMENT_CODE, validatePccIssueDate, type PccIssueDateError } from '../../../../../../shared/candidateDocuments/pccIssueDate';
import { documentQueries } from '../../../../../../shared/queryKeys/documentQueries';

interface UploadVariables {
  requirementCode: string;
  file: File;
  issuedOn: string;
  idempotencyKey: string;
  /** Captured at the moment `mutate()` is called, not read reactively when the request resolves -- lets onSuccess detect "the candidate logged out (or a different candidate is now signed in) since this request started" and skip touching the cache (ticket: "A completed upload must not update candidate data after logout" / "Do not leak one candidate's checklist into another candidate's session."). */
  accessTokenAtCallTime: string;
}

/**
 * Includes `issuedOn` so a candidate editing the PCC issue date between
 * attempts is treated the same as picking a different file -- the backend's
 * own idempotency fingerprint (Candidates::Documents::UploadFingerprint)
 * hashes `issued_on` alongside the file, so reusing a key across a changed
 * date would otherwise surface as a confusing idempotency_conflict instead
 * of just starting a fresh attempt. Mirrors mobile's useDocumentUpload.ts.
 */
function fileSignature(file: File, issuedOn: string): string {
  return `${file.name}:${file.size}:${file.lastModified}:${issuedOn}`;
}

/**
 * `issuedOn` is only appended for the police_character requirement -- the
 * backend rejects the request entirely if `expires_on` is ever supplied by
 * the client (PccExpiryNotEditableError), so that field is never sent here
 * at all; expiry is always server-calculated. Mirrors mobile's
 * useDocumentUpload.ts's buildFormData exactly.
 */
function buildFormData(requirementCode: string, file: File, issuedOn: string): FormData {
  const formData = new FormData();
  formData.append('candidate_document[requirement_code]', requirementCode);
  formData.append('candidate_document[file]', file);
  if (requirementCode === PCC_REQUIREMENT_CODE && issuedOn.trim()) {
    formData.append('candidate_document[issued_on]', issuedOn.trim());
  }
  return formData;
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
  const [issuedOn, setIssuedOnState] = useState('');
  const [issuedOnError, setIssuedOnError] = useState<PccIssueDateError | null>(null);
  const [idempotencyState, setIdempotencyState] = useState<IdempotencyKeyState>(EMPTY_IDEMPOTENCY_KEY_STATE);

  // A response for an item the candidate has since navigated away from
  // (by opening a different requirement's uploader) must not clear *that
  // new* selection's local state -- only the query cache update applies
  // unconditionally (it's keyed by the response's own requirementCode, so
  // it's race-safe regardless of what's currently active).
  const activeRequirementCodeRef = useRef<string | null>(null);
  activeRequirementCodeRef.current = activeRequirementCode;

  const isPccRequirement = activeRequirementCode === PCC_REQUIREMENT_CODE;

  const mutation = useMutation<CandidateDocumentChecklistItem, CandidateDocumentsError, UploadVariables>({
    mutationFn: ({ requirementCode, file, issuedOn, idempotencyKey, accessTokenAtCallTime }) =>
      candidateDocumentsClient.uploadDocument({
        accessToken: accessTokenAtCallTime,
        requirementCode,
        formData: buildFormData(requirementCode, file, issuedOn),
        idempotencyKey,
      }),
    onSuccess: (result, variables) => {
      if (session?.accessToken !== variables.accessTokenAtCallTime) return;

      queryClient.setQueryData<CandidateDocumentChecklistItem[]>(documentQueries.candidateChecklist(candidateId, language), (old) =>
        old ? old.map((item) => (item.requirementCode === result.requirementCode ? result : item)) : old
      );
      // A new/replaced document changes required-document counts, submission
      // state, compliance and the next recommended action -- all served by
      // the same application-progress response that Dashboard, Status and
      // Profile already read. Without this, those screens would keep
      // showing stale counts/next-action until their own query happened to
      // refetch on its own (focus/pull-to-refresh), even though the
      // checklist row above already updated (ticket: "refresh/invalidate
      // ... Application progress, Dashboard next action, Relevant
      // profile/document summaries").
      queryClient.invalidateQueries({ queryKey: documentQueries.applicationProgress(candidateId, language) });
      toast.success(t('candidateDocumentsUploadSuccessToast'));

      // Collapse the panel back to the row's normal display -- the
      // checklist item itself (now updated above) is the "success" state;
      // leaving the panel open would just silently relabel its own
      // Upload/Replace heading with no clear signal that anything happened.
      if (activeRequirementCodeRef.current === result.requirementCode) {
        setActiveRequirementCode(null);
        setFile(null);
        setValidationError(null);
        setIssuedOnState('');
        setIssuedOnError(null);
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
      setIssuedOnState('');
      setIssuedOnError(null);
      setIdempotencyState(EMPTY_IDEMPOTENCY_KEY_STATE);
      mutation.reset();
    },
    [mutation]
  );

  const cancelUpload = useCallback(() => {
    setActiveRequirementCode(null);
    setFile(null);
    setValidationError(null);
    setIssuedOnState('');
    setIssuedOnError(null);
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

  const setIssuedOn = useCallback((value: string) => {
    setIssuedOnState(value);
    setIssuedOnError(null);
  }, []);

  const submit = useCallback(() => {
    if (!file || !activeRequirementCode || !session || mutation.isPending) return;
    const error = validateSelectedFile({ name: file.name, size: file.size, type: file.type });
    setValidationError(error);
    if (error) return;

    if (isPccRequirement) {
      const dateError = validatePccIssueDate(issuedOn);
      setIssuedOnError(dateError);
      if (dateError) return;
    }

    // Resolved synchronously (not via a setState updater) so the freshly
    // decided key is available immediately for this same call -- reused
    // when the file/requirement/issue-date are unchanged from the last
    // attempt (a retry), minted fresh otherwise (a new file, a new
    // requirement, a changed issue date, or a key onError already cleared
    // after a conflict/forbidden replacement).
    const resolved = resolveIdempotencyKey(
      idempotencyState,
      { requirementCode: activeRequirementCode, fileSignature: fileSignature(file, issuedOn) },
      randomIdempotencyKey
    );
    setIdempotencyState(resolved);

    mutation.mutate({
      requirementCode: activeRequirementCode,
      file,
      issuedOn,
      idempotencyKey: resolved.key as string,
      accessTokenAtCallTime: session.accessToken,
    });
  }, [file, activeRequirementCode, session, idempotencyState, mutation, isPccRequirement, issuedOn]);

  return {
    activeRequirementCode,
    file,
    validationError,
    isPccRequirement,
    issuedOn,
    setIssuedOn,
    issuedOnError,
    startUpload,
    cancelUpload,
    selectFile,
    submit,
    /** Retry reuses the exact same call -- resolveIdempotencyKey already kept the same key since neither the file, requirement nor issue date changed. */
    retry: submit,
    mutation,
  };
}

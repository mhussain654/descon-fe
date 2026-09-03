import { useCallback, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  candidateImportClient,
  type CandidateImportCommitAccepted,
  type CandidateImportError,
  type CandidateImportPreflightResult,
} from '../../../../lib/candidate-import-client';
import { validateCsvFile, type CsvFileValidationError } from '../schemas/csvFile';

function randomIdempotencyKey(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export type CandidateImportWizardStep = 'select' | 'preview' | 'submitted';

/**
 * Owns the file-selection -> preflight-preview -> confirm-to-commit part of
 * the import flow. `step` is derived purely from the two mutations' own
 * success state, never tracked separately, so it can't drift out of sync
 * with what's actually happened. This hook's job ends the moment commit
 * returns its 202 -- that response is submission confirmation, never a
 * final result (ticket: "Treat the commit 202 Accepted response as
 * submission confirmation -- not final completion"), so there is no
 * "result" step here at all; what actually happened lives on the batch
 * detail page (useCandidateImportBatch), reached via the `importId` this
 * hook's `commitMutation.data` carries once it succeeds.
 *
 * A fresh idempotency key is generated once per successful preflight (not
 * per commit attempt) and reused across any retry of that same preflight --
 * a network/server failure followed by "Retry" must not risk double-
 * submitting (AGENTS.md: "Prevent accidental duplicate mutations"). This is
 * on top of the backend's own token-keyed idempotency (re-submitting an
 * already-claimed token safely replays the same accepted response), so
 * committing is safe to retry even without the header reaching the server.
 */
export function useCandidateImportWizard() {
  const [file, setFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<CsvFileValidationError | null>(null);
  const [commitIdempotencyKey, setCommitIdempotencyKey] = useState<string | null>(null);

  // TanStack Query's own `isPending` only updates once its notifyManager has
  // scheduled and flushed a re-render -- not synchronously with `mutate()`.
  // A burst of clicks landing inside that same window would all read the
  // same stale `isPending: false` closure and all call through. These refs
  // flip the instant `mutate()` is called, so a guard checking them is
  // correct regardless of render timing (AGENTS.md: "Prevent accidental
  // duplicate mutations" as a real guarantee, not one that depends on how
  // fast React happens to re-render).
  const isPreflightingRef = useRef(false);
  const isCommittingRef = useRef(false);

  const preflightMutation = useMutation<CandidateImportPreflightResult, CandidateImportError, void>({
    mutationFn: () => {
      if (!file) return Promise.reject({ code: 'UNKNOWN' } satisfies CandidateImportError);
      return candidateImportClient.preflightImport(file);
    },
    onSuccess: () => setCommitIdempotencyKey(randomIdempotencyKey('candidate-import-commit')),
    onSettled: () => {
      isPreflightingRef.current = false;
    },
  });

  const commitMutation = useMutation<CandidateImportCommitAccepted, CandidateImportError, void>({
    mutationFn: () => {
      const token = preflightMutation.data?.preflightToken;
      if (!token) return Promise.reject({ code: 'UNKNOWN' } satisfies CandidateImportError);
      return candidateImportClient.commitImport(token, commitIdempotencyKey ?? undefined);
    },
    onSettled: () => {
      isCommittingRef.current = false;
    },
  });

  const selectFile = useCallback(
    (nextFile: File | null) => {
      setFile(nextFile);
      setValidationError(validateCsvFile(nextFile));
      preflightMutation.reset();
      commitMutation.reset();
      setCommitIdempotencyKey(null);
    },
    [preflightMutation, commitMutation]
  );

  const submitPreflight = useCallback(() => {
    const error = validateCsvFile(file);
    setValidationError(error);
    if (error || isPreflightingRef.current) return;
    isPreflightingRef.current = true;
    preflightMutation.mutate();
  }, [file, preflightMutation]);

  const retryPreflight = useCallback(() => {
    if (isPreflightingRef.current) return;
    isPreflightingRef.current = true;
    preflightMutation.mutate();
  }, [preflightMutation]);

  const confirmCommit = useCallback(() => {
    if (isCommittingRef.current) return;
    isCommittingRef.current = true;
    commitMutation.mutate();
  }, [commitMutation]);

  const retryCommit = useCallback(() => {
    if (isCommittingRef.current) return;
    isCommittingRef.current = true;
    commitMutation.mutate();
  }, [commitMutation]);

  /**
   * A stale/expired/invalidated preflight token can never be committed no
   * matter how many times "Retry" is pressed -- the only real recovery is a
   * fresh preflight. Resets straight back to the select step but
   * deliberately keeps `file` set, since the file itself is still valid;
   * the candidate manager can re-run preflight on the very same selection
   * with one click rather than being forced to re-pick it from disk.
   */
  const startOverAfterExpiry = useCallback(() => {
    preflightMutation.reset();
    commitMutation.reset();
    setCommitIdempotencyKey(null);
  }, [preflightMutation, commitMutation]);

  /** Full reset for the correction/re-upload flow -- clears the file too, so "Choose a different file" from the preview or the result screen starts completely fresh. */
  const startOver = useCallback(() => {
    setFile(null);
    setValidationError(null);
    preflightMutation.reset();
    commitMutation.reset();
    setCommitIdempotencyKey(null);
  }, [preflightMutation, commitMutation]);

  const step: CandidateImportWizardStep = commitMutation.isSuccess ? 'submitted' : preflightMutation.isSuccess ? 'preview' : 'select';

  return {
    step,
    file,
    validationError,
    selectFile,
    submitPreflight,
    retryPreflight,
    confirmCommit,
    retryCommit,
    startOver,
    startOverAfterExpiry,
    preflightMutation,
    commitMutation,
  };
}

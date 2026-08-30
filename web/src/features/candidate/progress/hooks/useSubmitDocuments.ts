import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../../contexts/AuthContext';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { toast } from '../../../../design-system';
import { applicationProgressClient } from '../../../../lib/application-progress-client';
import type { ApplicationProgressError, DocumentSubmissionResult } from '../../../../lib/application-progress-client';
import {
  beginNewSubmissionAttempt,
  clearSubmissionIdempotencyKey,
  EMPTY_SUBMISSION_IDEMPOTENCY_KEY_STATE,
  randomSubmissionIdempotencyKey,
  retrySubmissionAttempt,
  type SubmissionIdempotencyKeyState,
} from '../../../../../../shared/applicationProgress/submissionIdempotency';
import { documentQueries } from '../../../../../../shared/queryKeys/documentQueries';

/** Error codes the candidate resolves by *changing something* (uploading, replacing, waiting for the state to settle elsewhere) rather than by pressing "Submit" again -- a stale confirmation dialog showing outdated blockers would be misleading, so these close it and refresh progress instead of offering a retry. */
const TERMINAL_ERROR_CODES = new Set<ApplicationProgressError['code']>([
  'NO_CURRENT_ASSIGNMENT',
  'NO_DOCUMENT_REQUIREMENTS',
  'DOCUMENTS_INCOMPLETE',
  'DOCUMENTS_REJECTED',
  'SUBMISSION_NOT_ALLOWED',
  'ALREADY_SUBMITTED',
]);

interface SubmitVariables {
  idempotencyKey: string;
  accessTokenAtCallTime: string;
}

export function useSubmitDocuments() {
  const { session } = useAuth();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const candidateId = session?.candidateId ?? 'anonymous';
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [idempotencyState, setIdempotencyState] = useState<SubmissionIdempotencyKeyState>(EMPTY_SUBMISSION_IDEMPOTENCY_KEY_STATE);

  const mutation = useMutation<DocumentSubmissionResult, ApplicationProgressError, SubmitVariables>({
    mutationFn: ({ idempotencyKey, accessTokenAtCallTime }) =>
      applicationProgressClient.submitDocuments({ accessToken: accessTokenAtCallTime, idempotencyKey }),
    onSuccess: (result, variables) => {
      if (session?.accessToken !== variables.accessTokenAtCallTime) return;

      queryClient.invalidateQueries({ queryKey: documentQueries.applicationProgress(candidateId, language) });
      queryClient.invalidateQueries({ queryKey: documentQueries.candidateChecklist(candidateId, language) });
      toast.success(result.message || t('applicationProgressSubmitSuccessFallback'));
      setConfirmOpen(false);
      setIdempotencyState(clearSubmissionIdempotencyKey());
    },
    onError: (error) => {
      if (error.code === 'CONFLICT') {
        setIdempotencyState(clearSubmissionIdempotencyKey());
        return;
      }
      if (TERMINAL_ERROR_CODES.has(error.code)) {
        setIdempotencyState(clearSubmissionIdempotencyKey());
        setConfirmOpen(false);
        queryClient.invalidateQueries({ queryKey: documentQueries.applicationProgress(candidateId, language) });
      }
      // RATE_LIMITED/NETWORK_ERROR/OFFLINE/SERVER_ERROR/IN_PROGRESS: keep the
      // dialog open and the same key so a manual retry replays safely
      // (ticket: "Offline/network/timeout/5xx: allow manual retry with the
      // same key.").
    },
  });

  const openConfirm = useCallback(() => {
    if (mutation.isPending) return;
    mutation.reset();
    setConfirmOpen(true);
  }, [mutation]);

  const closeConfirm = useCallback(() => {
    if (mutation.isPending) return;
    setConfirmOpen(false);
  }, [mutation]);

  const confirm = useCallback(() => {
    // Guards double-click/concurrent submission (ticket: "Prevent double-
    // click and concurrent submissions.") -- disabling the confirm button
    // while pending covers the UI, this covers a caller bypassing it.
    if (!session || mutation.isPending) return;

    const resolved = idempotencyState.key
      ? retrySubmissionAttempt(idempotencyState, randomSubmissionIdempotencyKey)
      : beginNewSubmissionAttempt(randomSubmissionIdempotencyKey);
    setIdempotencyState(resolved);
    mutation.mutate({ idempotencyKey: resolved.key as string, accessTokenAtCallTime: session.accessToken });
  }, [session, mutation, idempotencyState]);

  return { confirmOpen, openConfirm, closeConfirm, confirm, retry: confirm, mutation };
}

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
import { CANDIDATE_DOCUMENTS_QUERY_KEY } from '../../documents/hooks/useCandidateDocuments';
import { APPLICATION_PROGRESS_QUERY_KEY } from './useApplicationProgress';

/** Mirrors web/src/features/candidate/progress/hooks/useSubmitDocuments.ts's identical TERMINAL_ERROR_CODES exactly. */
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

/** Mirrors web's useSubmitDocuments.ts exactly -- see its comments for rationale. */
export function useSubmitDocuments() {
  const { session } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [idempotencyState, setIdempotencyState] = useState<SubmissionIdempotencyKeyState>(EMPTY_SUBMISSION_IDEMPOTENCY_KEY_STATE);

  const mutation = useMutation<DocumentSubmissionResult, ApplicationProgressError, SubmitVariables>({
    mutationFn: ({ idempotencyKey, accessTokenAtCallTime }) =>
      applicationProgressClient.submitDocuments({ accessToken: accessTokenAtCallTime, idempotencyKey }),
    onSuccess: (result, variables) => {
      if (session?.accessToken !== variables.accessTokenAtCallTime) return;

      queryClient.invalidateQueries({ queryKey: APPLICATION_PROGRESS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: CANDIDATE_DOCUMENTS_QUERY_KEY });
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
        queryClient.invalidateQueries({ queryKey: APPLICATION_PROGRESS_QUERY_KEY });
      }
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
    if (!session || mutation.isPending) return;

    const resolved = idempotencyState.key
      ? retrySubmissionAttempt(idempotencyState, randomSubmissionIdempotencyKey)
      : beginNewSubmissionAttempt(randomSubmissionIdempotencyKey);
    setIdempotencyState(resolved);
    mutation.mutate({ idempotencyKey: resolved.key as string, accessTokenAtCallTime: session.accessToken });
  }, [session, mutation, idempotencyState]);

  return { confirmOpen, openConfirm, closeConfirm, confirm, retry: confirm, mutation };
}

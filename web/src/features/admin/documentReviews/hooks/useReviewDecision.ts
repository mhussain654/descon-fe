import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { toast } from '../../../../design-system';
import { adminDocumentReviewsClient } from '../../../../lib/admin-document-reviews-client';
import type { AdminDocumentReviewError, ReviewDecisionResult } from '../../../../lib/admin-document-reviews-client';
import {
  clearDecisionIdempotencyKey,
  EMPTY_DECISION_IDEMPOTENCY_KEY_STATE,
  randomDecisionIdempotencyKey,
  resolveDecisionIdempotencyKey,
  type DecisionIdempotencyKeyState,
  type ReviewDecisionAction,
} from '../../../../../../shared/adminDocumentReviews/decisionIdempotency';
import { DOCUMENT_REVIEW_QUEUE_QUERY_KEY } from './useDocumentReviewQueue';
import { DOCUMENT_REVIEW_SUBMISSION_QUERY_KEY } from './useDocumentSubmission';

/**
 * Error codes meaning the document's review state has already moved on
 * elsewhere -- a stale confirm dialog would mislead, so these close it and
 * refresh detail/queue instead of offering a retry (ticket: "document_not_
 * pending_review: refresh detail and queue" / "document_already_reviewed:
 * refresh detail and queue").
 */
const TERMINAL_ERROR_CODES = new Set<AdminDocumentReviewError['code']>([
  'DOCUMENT_NOT_PENDING_REVIEW',
  'DOCUMENT_ALREADY_REVIEWED',
  'CANDIDATE_DOCUMENT_NOT_FOUND',
  'DOCUMENT_SUBMISSION_NOT_FOUND',
]);

interface ConfirmTarget {
  documentId: string;
  action: ReviewDecisionAction;
}

interface DecisionVariables {
  documentId: string;
  action: ReviewDecisionAction;
  reason: string;
  idempotencyKey: string;
}

/**
 * One hook instance serves every document in a submission -- `confirmTarget`
 * (rather than a documentId fixed at hook-call time) tracks *which* document
 * the open dialog applies to, since a submission detail page renders a
 * verify/reject action per document row.
 */
export function useReviewDecision(submissionId: string) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  const [reason, setReason] = useState('');
  const [idempotencyState, setIdempotencyState] = useState<DecisionIdempotencyKeyState>(
    EMPTY_DECISION_IDEMPOTENCY_KEY_STATE
  );

  const invalidateReviewData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [DOCUMENT_REVIEW_SUBMISSION_QUERY_KEY, submissionId] });
    queryClient.invalidateQueries({ queryKey: [DOCUMENT_REVIEW_QUEUE_QUERY_KEY] });
  }, [queryClient, submissionId]);

  const mutation = useMutation<ReviewDecisionResult, AdminDocumentReviewError, DecisionVariables>({
    mutationFn: ({ documentId, action, reason: rejectionReason, idempotencyKey }) =>
      action === 'verified'
        ? adminDocumentReviewsClient.verifyDocument(documentId, idempotencyKey)
        : adminDocumentReviewsClient.rejectDocument(documentId, rejectionReason, idempotencyKey),
    onSuccess: (_result, variables) => {
      invalidateReviewData();
      toast.success(
        variables.action === 'verified'
          ? t('adminDocumentReviewVerifySuccessToast')
          : t('adminDocumentReviewRejectSuccessToast')
      );
      setConfirmTarget(null);
      setReason('');
      setIdempotencyState(clearDecisionIdempotencyKey());
    },
    onError: (error) => {
      if (error.code === 'IDEMPOTENCY_CONFLICT') {
        setIdempotencyState(clearDecisionIdempotencyKey());
        return;
      }
      if (TERMINAL_ERROR_CODES.has(error.code)) {
        setIdempotencyState(clearDecisionIdempotencyKey());
        setConfirmTarget(null);
        invalidateReviewData();
        return;
      }
      // REJECTION_REASON_REQUIRED/REJECTION_REASON_INVALID: keep the dialog
      // open and the typed reason so the reviewer can fix and resubmit
      // (ticket: "Preserve the typed reason after retryable network/server
      // failures"; a validation error is exactly the case where wiping it
      // would be most disruptive).
      // RATE_LIMITED/NETWORK_ERROR/OFFLINE/SERVER_ERROR/IDEMPOTENCY_IN_PROGRESS:
      // keep the dialog open and the same key for manual retry.
    },
  });

  const openVerifyConfirm = useCallback(
    (documentId: string) => {
      if (mutation.isPending) return;
      mutation.reset();
      setIdempotencyState(EMPTY_DECISION_IDEMPOTENCY_KEY_STATE);
      setConfirmTarget({ documentId, action: 'verified' });
    },
    [mutation]
  );

  const openRejectConfirm = useCallback(
    (documentId: string) => {
      if (mutation.isPending) return;
      mutation.reset();
      setReason('');
      setIdempotencyState(EMPTY_DECISION_IDEMPOTENCY_KEY_STATE);
      setConfirmTarget({ documentId, action: 'rejected' });
    },
    [mutation]
  );

  const closeConfirm = useCallback(() => {
    if (mutation.isPending) return;
    setConfirmTarget(null);
    setReason('');
    setIdempotencyState(clearDecisionIdempotencyKey());
  }, [mutation]);

  const confirm = useCallback(() => {
    // Guards double-click/concurrent submission (ticket: "Prevent double-
    // click and concurrent mutation.") -- disabling the confirm button
    // while pending covers the UI, this covers a caller bypassing it.
    if (!confirmTarget || mutation.isPending) return;

    const { documentId, action } = confirmTarget;
    const trimmedReason = action === 'rejected' ? reason.trim() : '';
    const selection = { documentId, action, rejectionReason: trimmedReason };
    const resolved = resolveDecisionIdempotencyKey(idempotencyState, selection, randomDecisionIdempotencyKey);
    setIdempotencyState(resolved);
    mutation.mutate({ documentId, action, reason: trimmedReason, idempotencyKey: resolved.key as string });
  }, [confirmTarget, reason, mutation, idempotencyState]);

  return {
    confirmTarget,
    reason,
    setReason,
    openVerifyConfirm,
    openRejectConfirm,
    closeConfirm,
    confirm,
    retry: confirm,
    mutation,
  };
}

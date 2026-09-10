import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminDocumentReviewsClient } from '../../../../lib/admin-document-reviews-client';
import type {
  AdminDocumentReviewError,
  DocumentReviewQueueResult,
  QueueStatusFilter,
} from '../../../../lib/admin-document-reviews-client';
import { documentQueries } from '../../../../../../shared/queryKeys/documentQueries';

/**
 * Every real `ReviewState` the queue's status filter recognizes
 * (Admin::DocumentReviewQueueStatusFilter) -- explicit here because this
 * summary answers "what is this candidate's latest submission, whatever its
 * outcome", unlike the queue screen itself, which deliberately omits
 * `status` to fall back to the backend's pending-only default
 * (queueQueryParams.ts). `'rejected'` shares its clause with
 * `'changes_required'` and is omitted as redundant; the PCC-expiry filter
 * values are a different, orthogonal axis (document expiry, not review
 * outcome) and are intentionally left out.
 */
const ALL_REVIEW_STATUSES: QueueStatusFilter[] = [
  'pending_review',
  'partially_reviewed',
  'changes_required',
  'verified',
];

/**
 * Reuses the existing admin document-review queue endpoint, scoped to one
 * candidate (`filter[candidate_public_id]`) -- there is no separate
 * "candidate document summary" endpoint, and none is needed: the queue's own
 * `summary` counts are computed over every currently-applied filter except
 * `status` (Admin::DocumentReviewQueueQuery#summary), so scoping by
 * candidate here already yields per-candidate counts for free. Keyed by
 * `documentQueries.staffCandidateSummary`, the query key several other
 * admin-workflow hooks already invalidate in anticipation of this (see
 * useReviewDecision.ts, useSubmitWorkflowTransition.ts, etc.) -- this is the
 * first hook to actually populate it.
 */
export function useCandidateDocumentSummary(candidateId: string | undefined) {
  const { language } = useLanguage();

  return useQuery<DocumentReviewQueueResult, AdminDocumentReviewError>({
    queryKey: documentQueries.staffCandidateSummary(candidateId ?? '', language),
    queryFn: () =>
      adminDocumentReviewsClient.getQueue(
        { candidatePublicId: candidateId, status: ALL_REVIEW_STATUSES },
        { number: 1, size: 5 }
      ),
    enabled: Boolean(candidateId),
  });
}

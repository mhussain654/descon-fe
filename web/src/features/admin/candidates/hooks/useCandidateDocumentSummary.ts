import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminDocumentReviewsClient } from '../../../../lib/admin-document-reviews-client';
import type { AdminDocumentReviewError, DocumentReviewQueueResult } from '../../../../lib/admin-document-reviews-client';
import { documentQueries } from '../../../../../../shared/queryKeys/documentQueries';

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
    queryFn: () => adminDocumentReviewsClient.getQueue({ candidatePublicId: candidateId }, { number: 1, size: 5 }),
    enabled: Boolean(candidateId),
  });
}

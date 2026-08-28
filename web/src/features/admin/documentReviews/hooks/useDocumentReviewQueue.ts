import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminDocumentReviewsClient } from '../../../../lib/admin-document-reviews-client';
import type {
  AdminDocumentReviewError,
  DocumentReviewQueueFilters,
  DocumentReviewQueuePage,
  DocumentReviewQueueResult,
} from '../../../../lib/admin-document-reviews-client';

export const DOCUMENT_REVIEW_QUEUE_QUERY_KEY = 'admin-document-review-queue';

/**
 * The query key includes `filters`/`page` in full, so a filter or page
 * change is a genuinely different query -- TanStack Query's own key-based
 * request lifecycle then guarantees an in-flight response for a now-stale
 * key can never overwrite the data for the current one (ticket: "A previous
 * submission response must not replace a newly selected submission" /
 * "prevent stale responses from replacing newer results"), with no extra
 * plumbing needed here.
 */
export function useDocumentReviewQueue(filters: DocumentReviewQueueFilters, page: DocumentReviewQueuePage) {
  return useQuery<DocumentReviewQueueResult, AdminDocumentReviewError>({
    queryKey: [DOCUMENT_REVIEW_QUEUE_QUERY_KEY, filters, page],
    queryFn: () => adminDocumentReviewsClient.getQueue(filters, page),
    // Keeps the current page's rows on screen while the next page/filter
    // loads, instead of flashing back to a loading state (AGENTS.md: "Avoid
    // layout shift").
    placeholderData: keepPreviousData,
  });
}

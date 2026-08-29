import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminDocumentReviewsClient } from '../../../../lib/admin-document-reviews-client';
import type {
  AdminDocumentReviewError,
  DocumentReviewQueueFilters,
  DocumentReviewQueuePage,
  DocumentReviewQueueResult,
} from '../../../../lib/admin-document-reviews-client';
import { documentQueries } from '../../../../../../shared/queryKeys/documentQueries';

/**
 * The query key includes `filters`/`page`/`locale` in full, so a filter or
 * page change is a genuinely different query -- TanStack Query's own
 * key-based request lifecycle then guarantees an in-flight response for a
 * now-stale key can never overwrite the data for the current one (ticket: "A
 * previous submission response must not replace a newly selected
 * submission" / "prevent stale responses from replacing newer results"),
 * with no extra plumbing needed here.
 */
export function useDocumentReviewQueue(filters: DocumentReviewQueueFilters, page: DocumentReviewQueuePage) {
  const { language } = useLanguage();

  return useQuery<DocumentReviewQueueResult, AdminDocumentReviewError>({
    queryKey: documentQueries.staffQueue(filters, page, language),
    queryFn: () => adminDocumentReviewsClient.getQueue(filters, page),
    // Keeps the current page's rows on screen while the next page/filter
    // loads, instead of flashing back to a loading state (AGENTS.md: "Avoid
    // layout shift").
    placeholderData: keepPreviousData,
  });
}

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminCandidateClient } from '../../../../lib/admin-candidates-client';
import type {
  AdminCandidateError,
  AdminCandidateListFilters,
  AdminCandidateListPage,
  AdminCandidateListResult,
  AdminCandidateListSort,
} from '../../../../lib/admin-candidates-client';
import { adminCandidateQueries } from '../../../../../../shared/queryKeys/adminCandidateQueries';

/**
 * The query key includes `filters`/`sort`/`page`/`locale` in full, so any
 * change is a genuinely different query -- TanStack Query's own key-based
 * request lifecycle then guarantees an in-flight response for a now-stale
 * key can never overwrite the data for the current one, matching
 * useDocumentReviewQueue.ts's identical rationale.
 */
export function useCandidateList(filters: AdminCandidateListFilters, sort: AdminCandidateListSort | undefined, page: AdminCandidateListPage) {
  const { language } = useLanguage();

  return useQuery<AdminCandidateListResult, AdminCandidateError>({
    queryKey: adminCandidateQueries.list(filters, sort, page, language),
    queryFn: () => adminCandidateClient.listCandidates(filters, sort, page),
    // Keeps the current page's rows on screen while the next page/filter
    // loads, instead of flashing back to a loading state (AGENTS.md: "Avoid
    // layout shift").
    placeholderData: keepPreviousData,
  });
}

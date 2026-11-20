import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminCandidateClient, type AdminCandidateError } from '../../../../lib/admin-candidates-client';
import type { MobilizationFilters, MobilizationListResult, MobilizationPage, MobilizationSort } from '../../../../../../shared/adminCandidates/mobilizations';
import { adminCandidateQueries } from '../../../../../../shared/queryKeys/adminCandidateQueries';

/** Every filter, the sort, the page and the locale are part of the key, so a stale response never overwrites the current view. */
export function useMobilizationList(filters: MobilizationFilters, sort: MobilizationSort | undefined, page: MobilizationPage) {
  const { language } = useLanguage();

  return useQuery<MobilizationListResult, AdminCandidateError>({
    queryKey: adminCandidateQueries.mobilizations(filters, sort, page, language),
    queryFn: () => adminCandidateClient.listMobilizations(filters, sort, page),
    placeholderData: keepPreviousData,
  });
}

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminMpsDashboardClient, type MpsDashboardFilters, type TrendGranularity } from '../../../../lib/admin-mps-dashboard-client';
import { adminMpsDashboardQueries } from '../../../../../../shared/queryKeys/adminMpsDashboardQueries';

/** The MPS dashboard's summary (MPS-802), re-fetched whenever the mobilization-trend granularity or country/project/craft filters change. */
export function useMpsDashboard(granularity: TrendGranularity, filters: MpsDashboardFilters = {}) {
  const { language } = useLanguage();

  return useQuery({
    queryKey: adminMpsDashboardQueries.summary(granularity, language, filters),
    queryFn: () => adminMpsDashboardClient.getDashboard(granularity, filters),
    placeholderData: keepPreviousData,
  });
}

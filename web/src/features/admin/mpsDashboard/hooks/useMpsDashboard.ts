import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminMpsDashboardClient, type TrendGranularity } from '../../../../lib/admin-mps-dashboard-client';
import { adminMpsDashboardQueries } from '../../../../../../shared/queryKeys/adminMpsDashboardQueries';

/** The MPS dashboard's summary (MPS-802), re-fetched whenever the mobilization-trend granularity changes. */
export function useMpsDashboard(granularity: TrendGranularity) {
  const { language } = useLanguage();

  return useQuery({
    queryKey: adminMpsDashboardQueries.summary(granularity, language),
    queryFn: () => adminMpsDashboardClient.getDashboard(granularity),
    placeholderData: keepPreviousData,
  });
}

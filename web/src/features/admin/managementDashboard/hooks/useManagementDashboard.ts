import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminManagementDashboardClient, type TrendGranularity } from '../../../../lib/admin-management-dashboard-client';
import { adminManagementDashboardQueries } from '../../../../../../shared/queryKeys/adminManagementDashboardQueries';

/** The Management dashboard's summary (MPS-803), re-fetched whenever the mobilization-trend granularity changes. */
export function useManagementDashboard(granularity: TrendGranularity) {
  const { language } = useLanguage();

  return useQuery({
    queryKey: adminManagementDashboardQueries.summary(granularity, language),
    queryFn: () => adminManagementDashboardClient.getDashboard(granularity),
    placeholderData: keepPreviousData,
  });
}

import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminDashboardClient } from '../../../../lib/admin-dashboard-client';
import { adminDashboardQueries } from '../../../../../../shared/queryKeys/adminDashboardQueries';

/** The Admin dashboard's summary (MPS-801) -- no filters/pagination, so the query key only needs the locale. */
export function useAdminDashboard() {
  const { language } = useLanguage();

  return useQuery({
    queryKey: adminDashboardQueries.summary(language),
    queryFn: () => adminDashboardClient.getDashboard(),
  });
}

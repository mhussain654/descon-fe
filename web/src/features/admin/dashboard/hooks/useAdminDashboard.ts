import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminDashboardClient } from '../../../../lib/admin-dashboard-client';
import type { AdminDashboardFilters } from '../../../../lib/admin-dashboard-client';
import { adminDashboardQueries } from '../../../../../../shared/queryKeys/adminDashboardQueries';

/** The Admin dashboard's summary (MPS-801), scoped by the optional country/project/craft filters. */
export function useAdminDashboard(filters: AdminDashboardFilters = {}) {
  const { language } = useLanguage();

  return useQuery({
    queryKey: adminDashboardQueries.summary(language, filters),
    queryFn: () => adminDashboardClient.getDashboard(filters),
  });
}

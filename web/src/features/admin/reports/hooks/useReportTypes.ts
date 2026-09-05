import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminReportsClient } from '../../../../lib/admin-reports-client';
import { adminReportQueries } from '../../../../../../shared/queryKeys/adminReportQueries';

/** The reports catalogue (the list of report types this staff member may view/export) -- rarely changes within a session, so no pagination/filters to key on. */
export function useReportTypes() {
  const { language } = useLanguage();

  return useQuery({
    queryKey: adminReportQueries.types(language),
    queryFn: () => adminReportsClient.listReportTypes(),
  });
}

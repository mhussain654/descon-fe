import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminReportsClient, type ReportDataParams, type ReportType } from '../../../../lib/admin-reports-client';
import { adminReportQueries } from '../../../../../../shared/queryKeys/adminReportQueries';

/** One report's data, re-fetched whenever the report type or its params (currently only `granularity`, for `trend`) change. `enabled` lets the caller wait for a report type to actually be selected. */
export function useReportData(reportType: ReportType, params: ReportDataParams | undefined, enabled: boolean) {
  const { language } = useLanguage();

  return useQuery({
    queryKey: adminReportQueries.data(reportType, params, language),
    queryFn: () => adminReportsClient.getReportData(reportType, params),
    enabled,
    placeholderData: keepPreviousData,
  });
}

import { useMutation } from '@tanstack/react-query';
import { adminReportsClient, type ReportDataParams, type ReportError, type ReportExportFormat, type ReportType } from '../../../../lib/admin-reports-client';
import { triggerBlobDownload } from '../triggerBlobDownload';

interface ExportVariables {
  reportType: ReportType;
  format: ReportExportFormat;
  params?: ReportDataParams;
}

/** Downloads one report as a file and saves it -- a mutation (not a query) since it's a one-off, user-triggered action with no cached "current export" to keep around. */
export function useReportExport() {
  return useMutation<void, ReportError, ExportVariables>({
    mutationFn: async ({ reportType, format, params }) => {
      const result = await adminReportsClient.exportReport(reportType, format, params);
      triggerBlobDownload(result.blob, result.filename);
    },
  });
}

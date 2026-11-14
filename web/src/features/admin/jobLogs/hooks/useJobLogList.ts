import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import {
  adminJobLogsClient,
  type JobLogListError,
  type JobLogListFilters,
  type JobLogListPage,
  type JobLogListResult,
} from '../../../../lib/admin-job-logs-client';
import { adminJobLogQueries } from '../../../../../../shared/queryKeys/adminJobLogQueries';

/** One page of background job runs; `keepPreviousData` avoids a loading flash between pages and filters. */
export function useJobLogList(filters: JobLogListFilters, page: JobLogListPage) {
  const { language } = useLanguage();

  return useQuery<JobLogListResult, JobLogListError>({
    queryKey: adminJobLogQueries.list(filters, page, language),
    queryFn: () => adminJobLogsClient.listJobLogs(filters, page),
    placeholderData: keepPreviousData,
  });
}

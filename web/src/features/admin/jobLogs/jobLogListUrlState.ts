import { JOB_LOG_STATUSES, type JobLogListFilters, type JobLogListPage, type JobLogStatus } from '../../../../../shared/adminJobLogs/types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Reads the Job logs filters and page from the URL, dropping anything malformed. */
export function readJobLogListState(params: URLSearchParams): { filters: JobLogListFilters; page: JobLogListPage } {
  const status = params.get('status');
  const from = params.get('from');
  const to = params.get('to');
  const pageNumber = Number(params.get('page'));
  return {
    filters: {
      jobClass: params.get('job') || undefined,
      status: status && (JOB_LOG_STATUSES as string[]).includes(status) ? (status as JobLogStatus) : undefined,
      enqueuedFrom: from && ISO_DATE.test(from) ? from : undefined,
      enqueuedTo: to && ISO_DATE.test(to) ? to : undefined,
    },
    page: { number: Number.isInteger(pageNumber) && pageNumber > 1 ? pageNumber : undefined },
  };
}

export function writeJobLogListState(filters: JobLogListFilters, page: JobLogListPage): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.jobClass) params.set('job', filters.jobClass);
  if (filters.status) params.set('status', filters.status);
  if (filters.enqueuedFrom) params.set('from', filters.enqueuedFrom);
  if (filters.enqueuedTo) params.set('to', filters.enqueuedTo);
  if (page.number && page.number > 1) params.set('page', String(page.number));
  return params;
}

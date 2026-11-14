// Developer-only background job logs, wired to the real backend documented in
// descon-be's openapi.yaml:
//   GET /api/v1/admin/job_logs
//
// Read-only: Solid Queue job runs (pending, scheduled, running, finished,
// failed) and, for a failed run, why it failed. The job's arguments are never
// returned (they can carry personal data). Web-only.

export type JobLogStatus = 'pending' | 'scheduled' | 'running' | 'finished' | 'failed';

export const JOB_LOG_STATUSES: JobLogStatus[] = ['pending', 'scheduled', 'running', 'finished', 'failed'];

export interface JobLogError {
  exceptionClass: string;
  /** Redacted server-side and at most 1000 characters. */
  message: string;
  /** The first lines of the backtrace, without server paths. */
  backtrace: string[];
}

export interface JobLog {
  id: number;
  activeJobId?: string;
  jobClass: string;
  queueName: string;
  priority: number;
  status: JobLogStatus;
  /** 1 for the first run, higher for a retry. */
  attempt?: number;
  enqueuedAt: string;
  scheduledAt?: string;
  startedAt?: string;
  finishedAt?: string;
  failedAt?: string;
  error?: JobLogError;
}

export interface JobLogListFilters {
  jobClass?: string;
  status?: JobLogStatus;
  /** YYYY-MM-DD, inclusive. */
  enqueuedFrom?: string;
  /** YYYY-MM-DD, inclusive. */
  enqueuedTo?: string;
}

export interface JobLogListPage {
  number?: number;
  size?: number;
}

export interface JobLogListPagination {
  page: number;
  perPage: number;
  totalCount: number;
  totalPages: number;
}

export interface JobLogListResult {
  items: JobLog[];
  pagination: JobLogListPagination;
  /** Every job class for the job filter: each job under app/jobs plus any other recorded class. */
  jobClasses: string[];
}

export type JobLogErrorCode =
  | 'BAD_REQUEST'
  | 'FORBIDDEN'
  | 'INACTIVE_ACCOUNT'
  | 'SESSION_EXPIRED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface JobLogListError {
  code: JobLogErrorCode;
  /** Already-localized server message, when the backend provided one. */
  message?: string;
  field?: string;
}

export interface AdminJobLogsClient {
  listJobLogs(filters: JobLogListFilters, page: JobLogListPage): Promise<JobLogListResult>;
}

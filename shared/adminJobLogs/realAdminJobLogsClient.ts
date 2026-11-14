// Real AdminJobLogsClient, calling the backend documented in descon-be's
// openapi.yaml:
//   GET /api/v1/admin/job_logs
//
// Same shape as realAdminAuditEventsClient.ts: authenticatedDataRequest so a
// 400 (unknown job class, reversed date range) reaches the caller intact.
import type { ApiClient, ApiError } from '../api-client';
import type { StaffAuthClient, StaffAuthError } from '../auth/staffTypes';
import {
  JOB_LOG_STATUSES,
  type AdminJobLogsClient,
  type JobLog,
  type JobLogListError,
  type JobLogListFilters,
  type JobLogListPage,
  type JobLogListResult,
  type JobLogStatus,
} from './types';

interface JobLogResponse {
  id: number;
  active_job_id: string | null;
  job_class: string;
  queue_name: string;
  priority: number;
  status: string;
  attempt: number | null;
  enqueued_at: string;
  scheduled_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  failed_at: string | null;
  error: { exception_class: string; message: string; backtrace: string[] | null } | null;
}

export interface RealAdminJobLogsClientOptions {
  apiClient: ApiClient;
  staffAuthClient: StaffAuthClient;
  /** Read fresh on every call so a language switch is reflected immediately. */
  getLocale: () => 'en' | 'ur';
}

function appendParam(params: string[], key: string, value: string): void {
  params.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
}

/** Builds the query string; unset values are left out so the backend applies its defaults (page 1, 25 rows). */
export function buildJobLogListQuery(filters: JobLogListFilters, page: JobLogListPage): string {
  const params: string[] = [];
  if (filters.jobClass) appendParam(params, 'filter[job_class]', filters.jobClass);
  if (filters.status) appendParam(params, 'filter[status]', filters.status);
  if (filters.enqueuedFrom) appendParam(params, 'filter[enqueued_from]', filters.enqueuedFrom);
  if (filters.enqueuedTo) appendParam(params, 'filter[enqueued_to]', filters.enqueuedTo);
  if (page.number) appendParam(params, 'page[number]', String(page.number));
  if (page.size) appendParam(params, 'page[size]', String(page.size));
  return params.length > 0 ? `?${params.join('&')}` : '';
}

function toStatus(value: string): JobLogStatus {
  return (JOB_LOG_STATUSES as string[]).includes(value) ? (value as JobLogStatus) : 'pending';
}

function toJobLog(data: JobLogResponse): JobLog {
  return {
    id: data.id,
    activeJobId: data.active_job_id ?? undefined,
    jobClass: data.job_class,
    queueName: data.queue_name,
    priority: data.priority,
    status: toStatus(data.status),
    attempt: data.attempt ?? undefined,
    enqueuedAt: data.enqueued_at,
    scheduledAt: data.scheduled_at ?? undefined,
    startedAt: data.started_at ?? undefined,
    finishedAt: data.finished_at ?? undefined,
    failedAt: data.failed_at ?? undefined,
    error: data.error
      ? {
          exceptionClass: data.error.exception_class,
          message: data.error.message,
          backtrace: Array.isArray(data.error.backtrace) ? data.error.backtrace : [],
        }
      : undefined,
  };
}

function toPagination(raw: unknown): JobLogListResult['pagination'] {
  const value = (raw && typeof raw === 'object' ? raw : {}) as {
    page?: number;
    per_page?: number;
    total_count?: number;
    total_pages?: number;
  };
  return {
    page: typeof value.page === 'number' ? value.page : 1,
    perPage: typeof value.per_page === 'number' ? value.per_page : 0,
    totalCount: typeof value.total_count === 'number' ? value.total_count : 0,
    totalPages: typeof value.total_pages === 'number' ? value.total_pages : 0,
  };
}

function toJobClasses(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((value): value is string => typeof value === 'string') : [];
}

/** A StaffAuthError (from authenticatedDataRequest's own refresh path) has no `status`. */
function isStaffAuthError(error: unknown): error is StaffAuthError {
  return !!error && typeof error === 'object' && 'code' in error && !('status' in error);
}

function toListError(error: unknown): JobLogListError {
  if (isStaffAuthError(error)) {
    if (error.code === 'SESSION_EXPIRED') return { code: 'SESSION_EXPIRED' };
    if (error.code === 'NETWORK_ERROR') return { code: 'NETWORK_ERROR' };
    if (error.code === 'OFFLINE') return { code: 'OFFLINE' };
    return { code: 'UNKNOWN' };
  }

  const apiError = error as ApiError;
  if (!apiError || typeof apiError !== 'object' || !('code' in apiError)) return { code: 'UNKNOWN' };
  if (apiError.code === 'OFFLINE') return { code: 'OFFLINE' };
  if (apiError.code === 'NETWORK_ERROR' || apiError.code === 'TIMEOUT') return { code: 'NETWORK_ERROR' };
  if (apiError.code === 'CANCELLED') return { code: 'UNKNOWN' };
  if (apiError.status === 403) {
    return { code: apiError.serverCode === 'inactive_account' ? 'INACTIVE_ACCOUNT' : 'FORBIDDEN', message: apiError.message };
  }
  if (apiError.status === 400) return { code: 'BAD_REQUEST', message: apiError.message, field: apiError.field };
  if (apiError.status >= 500) return { code: 'SERVER_ERROR' };
  return { code: 'UNKNOWN', message: apiError.message };
}

export function createAdminJobLogsClient(options: RealAdminJobLogsClientOptions): AdminJobLogsClient {
  const { apiClient, staffAuthClient, getLocale } = options;

  return {
    async listJobLogs(filters: JobLogListFilters, page: JobLogListPage): Promise<JobLogListResult> {
      const query = buildJobLogListQuery(filters, page);
      try {
        const result = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.getWithMeta<JobLogResponse[]>(`/admin/job_logs${query}`, {
            headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() },
          })
        );
        if (!result) throw { code: 'UNKNOWN' } satisfies JobLogListError;

        const meta = result.meta as { pagination?: unknown; job_classes?: unknown } | undefined;
        return {
          items: Array.isArray(result.data) ? result.data.map(toJobLog) : [],
          pagination: toPagination(meta?.pagination),
          jobClasses: toJobClasses(meta?.job_classes),
        };
      } catch (error) {
        throw toListError(error);
      }
    },
  };
}

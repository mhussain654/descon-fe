// Real AdminReportsClient implementation (MPS-804/805/806), calling the
// backend documented in descon-be's openapi.yaml:
//   GET /api/v1/admin/reports
//   GET /api/v1/admin/reports/{report_type}
//   GET /api/v1/admin/reports/{report_type}/export
//
// Authentication for the JSON endpoints goes through
// StaffAuthClient.authenticatedDataRequest, not authenticatedRequest -- a
// 400 unknown-report-type response must reach the caller intact, matching
// realAdminAuditEventsClient.ts's identical rationale. The export endpoint
// uses authenticatedRequest instead since a binary ApiClient.getBinaryFile
// result isn't a data payload the 401-refresh-and-retry path needs to
// distinguish from an error the same way.
import type { ApiClient, ApiError } from '../api-client';
import type { StaffAuthClient, StaffAuthError } from '../auth/staffTypes';
import type {
  AdminReportsClient,
  ConversionRow,
  CraftSummaryRow,
  MobilizationRow,
  MobilizationSummary,
  OutcomeTracking,
  ReportData,
  ReportDataParams,
  ReportError,
  ReportErrorCode,
  ReportExportFormat,
  ReportExportResult,
  ReportType,
  StatusSummaryRow,
  TrendPoint,
} from './types';

export interface RealAdminReportsClientOptions {
  apiClient: ApiClient;
  staffAuthClient: StaffAuthClient;
  /** Read fresh on every call so a language switch is reflected immediately -- the backend localizes response messages and reference-data names per this header. */
  getLocale: () => 'en' | 'ur';
}

function granularityQuery(params?: ReportDataParams): string {
  return params?.granularity ? `?granularity=${encodeURIComponent(params.granularity)}` : '';
}

function toMobilizationRow(raw: unknown): MobilizationRow {
  const value = (raw && typeof raw === 'object' ? raw : {}) as { code?: string; name?: string; count?: number };
  return { code: value.code ?? '', name: value.name ?? '', count: value.count ?? 0 };
}

function toReportData(reportType: ReportType, data: unknown): ReportData {
  switch (reportType) {
    case 'status_summary':
      return { type: 'status_summary', rows: (data as StatusSummaryRow[]) ?? [] };
    case 'craft_summary':
      return { type: 'craft_summary', rows: (data as CraftSummaryRow[]) ?? [] };
    case 'conversion':
      return { type: 'conversion', rows: (data as ConversionRow[]) ?? [] };
    case 'trend':
      return { type: 'trend', rows: (data as TrendPoint[]) ?? [] };
    case 'outcome_tracking':
      return { type: 'outcome_tracking', summary: data as OutcomeTracking };
    case 'mobilization': {
      const raw = (data && typeof data === 'object' ? data : {}) as { by_country?: unknown[]; by_project?: unknown[] };
      const summary: MobilizationSummary = {
        byCountry: (raw.by_country ?? []).map(toMobilizationRow),
        byProject: (raw.by_project ?? []).map(toMobilizationRow),
      };
      return { type: 'mobilization', summary };
    }
  }
}

/** A StaffAuthError (from the 401 refresh-and-retry path) has no `status`; anything else here is the raw ApiError authenticatedDataRequest/authenticatedRequest rethrew unchanged. */
function isStaffAuthError(error: unknown): error is StaffAuthError {
  return !!error && typeof error === 'object' && 'code' in error && !('status' in error);
}

function toReportError(error: unknown): ReportError {
  if (isStaffAuthError(error)) {
    if (error.code === 'SESSION_EXPIRED') return { code: 'SESSION_EXPIRED' };
    if (error.code === 'NETWORK_ERROR') return { code: 'NETWORK_ERROR' };
    if (error.code === 'OFFLINE') return { code: 'OFFLINE' };
    return { code: 'UNKNOWN' };
  }

  const apiError = error as ApiError;
  if (!apiError || typeof apiError !== 'object' || !('code' in apiError)) {
    return { code: 'UNKNOWN' };
  }

  if (apiError.code === 'OFFLINE') return { code: 'OFFLINE' };
  if (apiError.code === 'NETWORK_ERROR' || apiError.code === 'TIMEOUT') return { code: 'NETWORK_ERROR' };
  if (apiError.code === 'CANCELLED') return { code: 'UNKNOWN' };

  return toReportErrorFromStatus(apiError);
}

function toReportErrorFromStatus(apiError: ApiError): ReportError {
  if (apiError.status === 403) {
    const code: ReportErrorCode = apiError.serverCode === 'inactive_account' ? 'INACTIVE_ACCOUNT' : 'FORBIDDEN';
    return { code, message: apiError.message };
  }
  if (apiError.status === 400) return { code: 'BAD_REQUEST', message: apiError.message, field: apiError.field };
  if (apiError.status === 429) return { code: 'RATE_LIMITED', message: apiError.message, retryAfterSeconds: apiError.retryAfterSeconds };
  if (apiError.status >= 500) return { code: 'SERVER_ERROR' };

  return { code: 'UNKNOWN', message: apiError.message };
}

export function createAdminReportsClient(options: RealAdminReportsClientOptions): AdminReportsClient {
  const { apiClient, staffAuthClient, getLocale } = options;

  return {
    async listReportTypes(): Promise<ReportType[]> {
      try {
        const result = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.get<ReportType[]>('/admin/reports', { headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() } })
        );
        return result ?? [];
      } catch (error) {
        throw toReportError(error);
      }
    },

    async getReportData(reportType: ReportType, params?: ReportDataParams): Promise<ReportData> {
      try {
        const result = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.get<unknown>(`/admin/reports/${reportType}${granularityQuery(params)}`, {
            headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() },
          })
        );
        return toReportData(reportType, result);
      } catch (error) {
        throw toReportError(error);
      }
    },

    async exportReport(reportType: ReportType, format: ReportExportFormat, params?: ReportDataParams): Promise<ReportExportResult> {
      const query = [`format=${format}`, params?.granularity ? `granularity=${params.granularity}` : undefined]
        .filter((part): part is string => Boolean(part))
        .join('&');
      try {
        const result = await staffAuthClient.authenticatedRequest((token) =>
          apiClient.getBinaryFile(`/admin/reports/${reportType}/export?${query}`, {
            headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() },
          })
        );
        if (!result) throw { code: 'UNKNOWN' } satisfies ReportError;

        return { blob: result.blob, filename: result.filename ?? `${reportType}.${format}` };
      } catch (error) {
        throw toReportError(error);
      }
    },
  };
}

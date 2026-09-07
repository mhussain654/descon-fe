// Real MpsDashboardClient implementation (MPS-802), calling the backend
// documented in descon-be's openapi.yaml:
//   GET /api/v1/admin/mps_dashboard
//
// Authentication goes through StaffAuthClient.authenticatedDataRequest, not
// authenticatedRequest -- matching every other real admin client's
// rationale (a 400 unsupported-granularity response must reach the caller
// intact).
import type { ApiClient, ApiError } from '../api-client';
import type { StaffAuthClient, StaffAuthError } from '../auth/staffTypes';
import type { CraftSummaryRow, StatusSummaryRow, TrendPoint } from '../adminReports/types';
import type { MpsDashboardClient, MpsDashboardError, MpsDashboardErrorCode, MpsDashboardSummary, TrendGranularity } from './types';

export interface RealAdminMpsDashboardClientOptions {
  apiClient: ApiClient;
  staffAuthClient: StaffAuthClient;
  /** Read fresh on every call so a language switch is reflected immediately -- the backend localizes response messages/reference-data names per this header. */
  getLocale: () => 'en' | 'ur';
}

interface MobilizationRowResponse {
  code: string;
  name: string;
  count: number;
}

interface DashboardResponse {
  workflow_stage_queue: StatusSummaryRow[];
  delayed_cases: { delayed: number; critical: number };
  craft_summary: CraftSummaryRow[];
  mobilization: { by_country: MobilizationRowResponse[]; by_project: MobilizationRowResponse[] };
  mobilization_trend: TrendPoint[];
}

function toDashboard(data: DashboardResponse): MpsDashboardSummary {
  return {
    workflowStageQueue: data.workflow_stage_queue,
    delayedCases: data.delayed_cases,
    craftSummary: data.craft_summary,
    mobilization: { byCountry: data.mobilization.by_country, byProject: data.mobilization.by_project },
    mobilizationTrend: data.mobilization_trend,
  };
}

/** A StaffAuthError (from the 401 refresh-and-retry path) has no `status`; anything else here is the raw ApiError authenticatedDataRequest rethrew unchanged. */
function isStaffAuthError(error: unknown): error is StaffAuthError {
  return !!error && typeof error === 'object' && 'code' in error && !('status' in error);
}

function toDashboardError(error: unknown): MpsDashboardError {
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

  if (apiError.status === 403) {
    const code: MpsDashboardErrorCode = apiError.serverCode === 'inactive_account' ? 'INACTIVE_ACCOUNT' : 'FORBIDDEN';
    return { code, message: apiError.message };
  }
  if (apiError.status === 400) return { code: 'BAD_REQUEST', message: apiError.message };
  if (apiError.status === 429) return { code: 'RATE_LIMITED', message: apiError.message, retryAfterSeconds: apiError.retryAfterSeconds };
  if (apiError.status >= 500) return { code: 'SERVER_ERROR' };

  return { code: 'UNKNOWN', message: apiError.message };
}

export function createAdminMpsDashboardClient(options: RealAdminMpsDashboardClientOptions): MpsDashboardClient {
  const { apiClient, staffAuthClient, getLocale } = options;

  return {
    async getDashboard(granularity?: TrendGranularity): Promise<MpsDashboardSummary> {
      const query = granularity ? `?granularity=${encodeURIComponent(granularity)}` : '';
      try {
        const result = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.get<DashboardResponse>(`/admin/mps_dashboard${query}`, {
            headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() },
          })
        );
        if (!result) throw { code: 'UNKNOWN' } satisfies MpsDashboardError;

        return toDashboard(result);
      } catch (error) {
        throw toDashboardError(error);
      }
    },
  };
}

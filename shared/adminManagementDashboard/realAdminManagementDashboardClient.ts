// Real ManagementDashboardClient implementation (MPS-803), calling the
// backend documented in descon-be's openapi.yaml:
//   GET /api/v1/admin/management_dashboard
//
// Authentication goes through StaffAuthClient.authenticatedDataRequest, not
// authenticatedRequest -- matching every other real admin client's
// rationale (a 400 unsupported-granularity response must reach the caller
// intact).
import type { ApiClient, ApiError } from '../api-client';
import type { StaffAuthClient, StaffAuthError } from '../auth/staffTypes';
import type { ConversionRow, OutcomeTracking, TrendPoint } from '../adminReports/types';
import type {
  ManagementDashboardClient,
  ManagementDashboardError,
  ManagementDashboardErrorCode,
  ManagementDashboardSummary,
  TrendGranularity,
} from './types';

export interface RealAdminManagementDashboardClientOptions {
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
  conversion_funnel: ConversionRow[];
  outcome_tracking: {
    rejected_documents: number;
    qvc_re_medical: number;
    qvc_rejected: number;
    qvc_no_show: number;
    visa_rejected: number;
  };
  mobilization: { by_country: MobilizationRowResponse[]; by_project: MobilizationRowResponse[] };
  mobilization_trend: TrendPoint[];
}

function toOutcomeTracking(data: DashboardResponse['outcome_tracking']): OutcomeTracking {
  return {
    rejectedDocuments: data.rejected_documents,
    qvcReMedical: data.qvc_re_medical,
    qvcRejected: data.qvc_rejected,
    qvcNoShow: data.qvc_no_show,
    visaRejected: data.visa_rejected,
  };
}

function toDashboard(data: DashboardResponse): ManagementDashboardSummary {
  return {
    conversionFunnel: data.conversion_funnel,
    outcomeTracking: toOutcomeTracking(data.outcome_tracking),
    mobilization: { byCountry: data.mobilization.by_country, byProject: data.mobilization.by_project },
    mobilizationTrend: data.mobilization_trend,
  };
}

/** A StaffAuthError (from the 401 refresh-and-retry path) has no `status`; anything else here is the raw ApiError authenticatedDataRequest rethrew unchanged. */
function isStaffAuthError(error: unknown): error is StaffAuthError {
  return !!error && typeof error === 'object' && 'code' in error && !('status' in error);
}

function toDashboardError(error: unknown): ManagementDashboardError {
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
    const code: ManagementDashboardErrorCode = apiError.serverCode === 'inactive_account' ? 'INACTIVE_ACCOUNT' : 'FORBIDDEN';
    return { code, message: apiError.message };
  }
  if (apiError.status === 400) return { code: 'BAD_REQUEST', message: apiError.message };
  if (apiError.status === 429) return { code: 'RATE_LIMITED', message: apiError.message, retryAfterSeconds: apiError.retryAfterSeconds };
  if (apiError.status >= 500) return { code: 'SERVER_ERROR' };

  return { code: 'UNKNOWN', message: apiError.message };
}

export function createAdminManagementDashboardClient(options: RealAdminManagementDashboardClientOptions): ManagementDashboardClient {
  const { apiClient, staffAuthClient, getLocale } = options;

  return {
    async getDashboard(granularity?: TrendGranularity): Promise<ManagementDashboardSummary> {
      const query = granularity ? `?granularity=${encodeURIComponent(granularity)}` : '';
      try {
        const result = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.get<DashboardResponse>(`/admin/management_dashboard${query}`, {
            headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() },
          })
        );
        if (!result) throw { code: 'UNKNOWN' } satisfies ManagementDashboardError;

        return toDashboard(result);
      } catch (error) {
        throw toDashboardError(error);
      }
    },
  };
}

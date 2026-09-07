// Real AdminDashboardClient implementation (MPS-801), calling the backend
// documented in descon-be's openapi.yaml:
//   GET /api/v1/admin/dashboard
//
// Authentication goes through StaffAuthClient.authenticatedDataRequest, not
// authenticatedRequest -- matching every other real admin client's
// rationale (an error response must reach the caller intact).
import type { ApiClient, ApiError } from '../api-client';
import type { StaffAuthClient, StaffAuthError } from '../auth/staffTypes';
import type { AdminDashboardClient, AdminDashboardError, AdminDashboardErrorCode, AdminDashboardSummary, PaymentSummaryRow } from './types';

export interface RealAdminDashboardClientOptions {
  apiClient: ApiClient;
  staffAuthClient: StaffAuthClient;
  /** Read fresh on every call so a language switch is reflected immediately -- the backend localizes response messages per this header. */
  getLocale: () => 'en' | 'ur';
}

interface DashboardResponse {
  candidate_workload: { total_active_candidates: number };
  workflow_stage_queue: { code: string; position: number; count: number }[];
  document_review_queue: {
    pending_review: number;
    verified: number;
    rejected: number;
    expired_pcc: number;
    near_expiry_pcc: number;
  };
  payment_summary: { code: string; count: number }[];
}

function toDashboard(data: DashboardResponse): AdminDashboardSummary {
  return {
    candidateWorkload: { totalActiveCandidates: data.candidate_workload.total_active_candidates },
    workflowStageQueue: data.workflow_stage_queue,
    documentReviewQueue: {
      pendingReview: data.document_review_queue.pending_review,
      verified: data.document_review_queue.verified,
      rejected: data.document_review_queue.rejected,
      expiredPcc: data.document_review_queue.expired_pcc,
      nearExpiryPcc: data.document_review_queue.near_expiry_pcc,
    },
    paymentSummary: data.payment_summary as PaymentSummaryRow[],
  };
}

/** A StaffAuthError (from the 401 refresh-and-retry path) has no `status`; anything else here is the raw ApiError authenticatedDataRequest rethrew unchanged. */
function isStaffAuthError(error: unknown): error is StaffAuthError {
  return !!error && typeof error === 'object' && 'code' in error && !('status' in error);
}

function toDashboardError(error: unknown): AdminDashboardError {
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
    const code: AdminDashboardErrorCode = apiError.serverCode === 'inactive_account' ? 'INACTIVE_ACCOUNT' : 'FORBIDDEN';
    return { code, message: apiError.message };
  }
  if (apiError.status === 429) return { code: 'RATE_LIMITED', message: apiError.message, retryAfterSeconds: apiError.retryAfterSeconds };
  if (apiError.status >= 500) return { code: 'SERVER_ERROR' };

  return { code: 'UNKNOWN', message: apiError.message };
}

export function createAdminDashboardClient(options: RealAdminDashboardClientOptions): AdminDashboardClient {
  const { apiClient, staffAuthClient, getLocale } = options;

  return {
    async getDashboard(): Promise<AdminDashboardSummary> {
      try {
        const result = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.get<DashboardResponse>('/admin/dashboard', { headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() } })
        );
        if (!result) throw { code: 'UNKNOWN' } satisfies AdminDashboardError;

        return toDashboard(result);
      } catch (error) {
        throw toDashboardError(error);
      }
    },
  };
}

// Real AdminDashboardClient implementation (MPS-801), calling the backend
// documented in descon-be's openapi.yaml:
//   GET /api/v1/admin/dashboard
//
// Authentication goes through StaffAuthClient.authenticatedDataRequest, not
// authenticatedRequest -- matching every other real admin client's
// rationale (an error response must reach the caller intact).
import type { ApiClient, ApiError } from '../api-client';
import type { StaffAuthClient, StaffAuthError } from '../auth/staffTypes';
import { buildDashboardQuery } from './dashboardQueryParams';
import type {
  AdminDashboardClient,
  AdminDashboardError,
  AdminDashboardErrorCode,
  AdminDashboardFilters,
  AdminDashboardSummary,
  PaymentSummaryRow,
  RequiresAttentionRow,
  UpcomingActivityRow,
} from './types';

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
  conversion_funnel: { code: string; count: number; percentage: number }[];
  average_stage_duration_days: number | null;
  requires_attention: { code: string; count: number }[];
  upcoming_activities: {
    type: string;
    occurs_on: string;
    candidate_assignment_public_id: string;
    reference_number: string;
  }[];
  recently_updated_candidates: {
    candidate_full_name: string;
    candidate_public_id: string;
    candidate_assignment_public_id: string;
    reference_number: string;
    workflow_stage_code: string;
    last_updated_at: string;
  }[];
  kpi_trends: {
    active_candidates: { date: string; count: number }[];
    paid_payments: { date: string; count: number }[];
    mobilized: { date: string; count: number }[];
  };
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
    conversionFunnel: data.conversion_funnel,
    averageStageDurationDays: data.average_stage_duration_days,
    requiresAttention: data.requires_attention as RequiresAttentionRow[],
    upcomingActivities: data.upcoming_activities.map((row) => ({
      type: row.type,
      occursOn: row.occurs_on,
      candidateAssignmentPublicId: row.candidate_assignment_public_id,
      referenceNumber: row.reference_number,
    })) as UpcomingActivityRow[],
    recentlyUpdatedCandidates: data.recently_updated_candidates.map((row) => ({
      candidateFullName: row.candidate_full_name,
      candidatePublicId: row.candidate_public_id,
      candidateAssignmentPublicId: row.candidate_assignment_public_id,
      referenceNumber: row.reference_number,
      workflowStageCode: row.workflow_stage_code,
      lastUpdatedAt: row.last_updated_at,
    })),
    kpiTrends: {
      activeCandidates: data.kpi_trends.active_candidates,
      paidPayments: data.kpi_trends.paid_payments,
      mobilized: data.kpi_trends.mobilized,
    },
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

  if (apiError.status === 400) return { code: 'INVALID_FILTER', message: apiError.message, field: apiError.field };
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
    async getDashboard(filters: AdminDashboardFilters = {}): Promise<AdminDashboardSummary> {
      try {
        const query = buildDashboardQuery(filters);
        const result = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.get<DashboardResponse>(`/admin/dashboard${query}`, { headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() } })
        );
        if (!result) throw { code: 'UNKNOWN' } satisfies AdminDashboardError;

        return toDashboard(result);
      } catch (error) {
        throw toDashboardError(error);
      }
    },
  };
}

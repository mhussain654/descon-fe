// Real AdminPaymentsClient implementation (MPS-F602), calling the backend
// documented in descon-be's openapi.yaml:
//   GET  /api/v1/admin/payments
//   GET  /api/v1/admin/payments/{id}
//   POST /api/v1/admin/payments/{id}/corrections
//
// Authentication goes through StaffAuthClient.authenticatedDataRequest, not
// authenticatedRequest -- this domain's own error shapes (a 409 stale-
// payment or idempotency conflict, a 422 correction-not-allowed with a
// specific field, a 404 for an unknown payment) must reach the caller
// intact, which authenticatedRequest's generic StaffAuthError mapping would
// otherwise discard (see staffTypes.ts's doc comment on
// authenticatedDataRequest, and realCandidateImportClient.ts's identical
// rationale).
import type { ApiClient, ApiError } from '../api-client';
import type { StaffAuthClient, StaffAuthError } from '../auth/staffTypes';
import { buildPaymentListQuery } from './paymentListQueryParams';
import type {
  AdminPaymentError,
  AdminPaymentErrorCode,
  AdminPaymentsClient,
  AdminPaymentStatus,
  PaymentActorRef,
  PaymentCandidateRef,
  PaymentCorrectionRequest,
  PaymentDetail,
  PaymentEvent,
  PaymentListFilters,
  PaymentListPage,
  PaymentListResult,
  PaymentListSort,
  PaymentSummary,
  ReconciliationFinding,
} from './types';

interface AdminPaymentCandidateResponse {
  id: string;
  full_name: string;
  masked_cnic: string;
  reference_number: string;
}

interface AdminPaymentActorResponse {
  id: string;
  role: string;
}

interface AdminPaymentEventResponse {
  id: string;
  event_type: string;
  event_source: string;
  provider_status_code?: string | null;
  occurred_at: string;
  actor?: AdminPaymentActorResponse | null;
}

interface AdminPaymentReconciliationFindingResponse {
  id: string;
  finding_code: string;
  state: string;
  resolved_at?: string | null;
  resolved_by?: AdminPaymentActorResponse | null;
  resolution_note?: string | null;
  created_at: string;
}

interface AdminPaymentSummaryResponse {
  id: string;
  candidate: AdminPaymentCandidateResponse;
  payment_type_code: string;
  status: string;
  amount: string;
  currency_code: string;
  provider: string;
  external_reference?: string | null;
  reconciliation_state: string;
  paid_at?: string | null;
  created_at: string;
  updated_at: string;
}

interface AdminPaymentDetailResponse extends AdminPaymentSummaryResponse {
  payment_events: AdminPaymentEventResponse[];
  reconciliation_findings: AdminPaymentReconciliationFindingResponse[];
}

export interface RealAdminPaymentsClientOptions {
  apiClient: ApiClient;
  staffAuthClient: StaffAuthClient;
  /** Read fresh on every call so a language switch is reflected immediately -- the backend localizes response messages per this header (same convention as every other real staff client in this repo). */
  getLocale: () => 'en' | 'ur';
}

const KNOWN_STATUSES = new Set<string>(['checkout_pending', 'paid', 'failed', 'cancelled']);

function toStatus(raw: string): AdminPaymentStatus {
  // Payment::STATUS_CODES is a closed, validated enum -- an unrecognized
  // value here would mean a contract drift this client doesn't yet know
  // about. Falling back to 'checkout_pending' is the most conservative
  // choice: it never falsely implies a terminal outcome (paid/failed/
  // cancelled) for a status this client can't actually recognize.
  return (KNOWN_STATUSES.has(raw) ? raw : 'checkout_pending') as AdminPaymentStatus;
}

function toActorRef(actor: AdminPaymentActorResponse | null | undefined): PaymentActorRef | undefined {
  return actor ? { id: actor.id, role: actor.role } : undefined;
}

function toCandidateRef(candidate: AdminPaymentCandidateResponse): PaymentCandidateRef {
  return {
    id: candidate.id,
    fullName: candidate.full_name,
    maskedCnic: candidate.masked_cnic,
    referenceNumber: candidate.reference_number,
  };
}

function toEvent(event: AdminPaymentEventResponse): PaymentEvent {
  return {
    id: event.id,
    eventType: event.event_type,
    eventSource: event.event_source,
    providerStatusCode: event.provider_status_code ?? undefined,
    occurredAt: event.occurred_at,
    actor: toActorRef(event.actor),
  };
}

function toFinding(finding: AdminPaymentReconciliationFindingResponse): ReconciliationFinding {
  return {
    id: finding.id,
    findingCode: finding.finding_code as ReconciliationFinding['findingCode'],
    state: finding.state as ReconciliationFinding['state'],
    resolvedAt: finding.resolved_at ?? undefined,
    resolvedBy: toActorRef(finding.resolved_by),
    resolutionNote: finding.resolution_note ?? undefined,
    createdAt: finding.created_at,
  };
}

function toSummary(data: AdminPaymentSummaryResponse): PaymentSummary {
  return {
    id: data.id,
    candidate: toCandidateRef(data.candidate),
    paymentTypeCode: data.payment_type_code,
    status: toStatus(data.status),
    amount: data.amount,
    currencyCode: data.currency_code,
    provider: data.provider,
    externalReference: data.external_reference ?? undefined,
    reconciliationState: data.reconciliation_state as PaymentSummary['reconciliationState'],
    paidAt: data.paid_at ?? undefined,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function toDetail(data: AdminPaymentDetailResponse): PaymentDetail {
  return {
    ...toSummary(data),
    paymentEvents: data.payment_events.map(toEvent),
    reconciliationFindings: data.reconciliation_findings.map(toFinding),
  };
}

function toPagination(raw: unknown): PaymentListResult['pagination'] {
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

function toAppliedFilters(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  );
}

/** A StaffAuthError (from the 401 refresh-and-retry path) has no `status`; anything else here is the raw ApiError authenticatedDataRequest rethrew unchanged. */
function isStaffAuthError(error: unknown): error is StaffAuthError {
  return !!error && typeof error === 'object' && 'code' in error && !('status' in error);
}

function toAdminPaymentError(error: unknown): AdminPaymentError {
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

  return toAdminPaymentErrorFromStatus(apiError);
}

function toAdminPaymentErrorFromStatus(apiError: ApiError): AdminPaymentError {
  if (apiError.status === 403) {
    const code: AdminPaymentErrorCode = apiError.serverCode === 'inactive_account' ? 'INACTIVE_ACCOUNT' : 'FORBIDDEN';
    return { code, message: apiError.message };
  }
  if (apiError.status === 404) return { code: 'NOT_FOUND', message: apiError.message };
  if (apiError.status === 400) {
    const code: AdminPaymentErrorCode = apiError.serverCode === 'missing_idempotency_key' ? 'MISSING_IDEMPOTENCY_KEY' : 'BAD_REQUEST';
    return { code, message: apiError.message, field: apiError.field };
  }
  if (apiError.status === 409) {
    const code: AdminPaymentErrorCode = apiError.serverCode === 'stale_payment' ? 'STALE_PAYMENT' : 'CONFLICT';
    return { code, message: apiError.message };
  }
  if (apiError.status === 422) {
    const code: AdminPaymentErrorCode = apiError.serverCode === 'payment_correction_not_allowed' ? 'CORRECTION_NOT_ALLOWED' : 'VALIDATION_FAILED';
    return { code, message: apiError.message, field: apiError.field };
  }
  if (apiError.status === 429) return { code: 'RATE_LIMITED', message: apiError.message, retryAfterSeconds: apiError.retryAfterSeconds };
  if (apiError.status >= 500) return { code: 'SERVER_ERROR' };

  return { code: 'UNKNOWN', message: apiError.message };
}

export function createAdminPaymentsClient(options: RealAdminPaymentsClientOptions): AdminPaymentsClient {
  const { apiClient, staffAuthClient, getLocale } = options;

  return {
    async listPayments(filters: PaymentListFilters, sort: PaymentListSort | undefined, page: PaymentListPage): Promise<PaymentListResult> {
      const query = buildPaymentListQuery(filters, sort, page);
      try {
        const result = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.getWithMeta<AdminPaymentSummaryResponse[]>(`/admin/payments${query}`, {
            headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() },
          })
        );
        if (!result) throw { code: 'UNKNOWN' } satisfies AdminPaymentError;

        const items = Array.isArray(result.data) ? result.data.map(toSummary) : [];
        const meta = result.meta as { pagination?: unknown; applied_filters?: unknown } | undefined;
        return {
          items,
          pagination: toPagination(meta?.pagination),
          appliedFilters: toAppliedFilters(meta?.applied_filters),
        };
      } catch (error) {
        throw toAdminPaymentError(error);
      }
    },

    async getPayment(paymentId: string): Promise<PaymentDetail> {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.get<AdminPaymentDetailResponse>(`/admin/payments/${encodeURIComponent(paymentId)}`, {
            headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() },
          })
        );
        if (!data) throw { code: 'UNKNOWN' } satisfies AdminPaymentError;
        return toDetail(data);
      } catch (error) {
        throw toAdminPaymentError(error);
      }
    },

    async correctPayment(paymentId: string, correction: PaymentCorrectionRequest, idempotencyKey?: string): Promise<PaymentDetail> {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.post<AdminPaymentDetailResponse>(
            `/admin/payments/${encodeURIComponent(paymentId)}/corrections`,
            {
              correction: {
                reason: correction.reason,
                expected_updated_at: correction.expectedUpdatedAt,
                finding_id: correction.findingId,
                field: correction.field,
                value: correction.value,
              },
            },
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'X-Locale': getLocale(),
                ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
              },
            }
          )
        );
        if (!data) throw { code: 'UNKNOWN' } satisfies AdminPaymentError;
        return toDetail(data);
      } catch (error) {
        throw toAdminPaymentError(error);
      }
    },
  };
}

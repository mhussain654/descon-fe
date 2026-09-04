// Admin finance payment workspace types (MPS-F602), wired to the real
// backend documented in descon-be's openapi.yaml:
//   GET  /api/v1/admin/payments
//   GET  /api/v1/admin/payments/{id}
//   POST /api/v1/admin/payments/{id}/corrections
//
// MPS-605 (backend) built these endpoints from scratch for this ticket --
// there was no admin/staff payment API at all before this (only the
// candidate's own self-service GET/POST /candidate/payment, see
// shared/payments/types.ts). This is therefore a genuinely new, independent
// type set -- not an extension of the candidate-facing PaymentStatus union,
// which is checkout-lifecycle-shaped, not reconciliation/correction-shaped.
//
// Web-only (AGENTS.md: "administrative workflows remain web-focused").

/** Matches Payment::STATUS_CODES exactly. */
export type AdminPaymentStatus = 'checkout_pending' | 'paid' | 'failed' | 'cancelled';

/** Derived from this payment's own reconciliation findings -- never queried separately, always part of the payment response itself. */
export type PaymentReconciliationState = 'clean' | 'open' | 'resolved';

/** Matches Payments::ReconciliationService::FINDINGS' keys exactly. */
export type ReconciliationFindingCode =
  | 'paid_at_missing'
  | 'external_reference_missing'
  | 'duplicate_external_reference'
  | 'workflow_payment_mismatch'
  | 'terminal_event_conflict';

export type ReconciliationFindingState = 'open' | 'resolved';

/** A staff actor reference -- id + role only, matching Admin::CandidateDocumentSerializer's own convention (never a fabricated name). */
export interface PaymentActorRef {
  id: string;
  role: string;
}

export interface PaymentCandidateRef {
  id: string;
  fullName: string;
  /** Already masked server-side (Candidates::CnicMasker) -- never a full CNIC. */
  maskedCnic: string;
  referenceNumber: string;
}

/**
 * A safe, staff-facing view of one payment event -- never carries the raw
 * provider callback/return payload, provider secrets, signatures, or
 * internal correlation identifiers. `id` is the provider's own event_key,
 * not an internal database id.
 */
export interface PaymentEvent {
  id: string;
  eventType: string;
  eventSource: string;
  providerStatusCode?: string;
  occurredAt: string;
  actor?: PaymentActorRef;
}

export interface ReconciliationFinding {
  id: string;
  findingCode: ReconciliationFindingCode;
  state: ReconciliationFindingState;
  resolvedAt?: string;
  resolvedBy?: PaymentActorRef;
  resolutionNote?: string;
  createdAt: string;
}

/** One transaction-list row, or the base of PaymentDetail. `amount` is a decimal STRING -- never parse as a JS number for anything money-related (same convention as shared/payments/types.ts's Payment.amount). */
export interface PaymentSummary {
  id: string;
  candidate: PaymentCandidateRef;
  paymentTypeCode: string;
  status: AdminPaymentStatus;
  amount: string;
  currencyCode: string;
  provider: string;
  externalReference?: string;
  reconciliationState: PaymentReconciliationState;
  paidAt?: string;
  createdAt: string;
  /** Echo this back as `expectedUpdatedAt` on a correction -- the backend's stale-update guard compares it against the payment's current `updated_at`. */
  updatedAt: string;
}

/** The sole source of truth for a payment's current state, final counts and history -- never derived or cached anywhere else on the frontend. */
export interface PaymentDetail extends PaymentSummary {
  paymentEvents: PaymentEvent[];
  reconciliationFindings: ReconciliationFinding[];
}

/**
 * Server-side list filters for GET /api/v1/admin/payments
 * (Admin::Payments::IndexQuery). There is no candidate/actor-identity filter
 * exposed here beyond free-text `search` -- the backend's own filter list is
 * exactly status/provider_code/payment_type_code/currency_code/created_from/
 * created_to/reconciliation_state.
 */
export interface PaymentListFilters {
  /** Matches candidate full name, assignment reference number, or external_reference (Admin::Payments::IndexQuery#apply_search). */
  search?: string;
  status?: AdminPaymentStatus;
  providerCode?: string;
  paymentTypeCode?: string;
  currencyCode?: string;
  /** ISO 8601 date (not datetime). */
  createdFrom?: string;
  createdTo?: string;
  reconciliationState?: PaymentReconciliationState;
}

/** Matches Admin::Payments::IndexQuery::ALLOWED_SORTS, `-` prefix for descending. Defaults to `-created_at` server-side when omitted. */
export type PaymentListSort = 'created_at' | '-created_at' | 'paid_at' | '-paid_at' | 'amount' | '-amount' | 'status_code' | '-status_code';

export interface PaymentListPage {
  number?: number;
  size?: number;
}

export interface PaymentListPagination {
  page: number;
  perPage: number;
  totalCount: number;
  totalPages: number;
}

export interface PaymentListResult {
  items: PaymentSummary[];
  pagination: PaymentListPagination;
  appliedFilters: Record<string, string>;
}

/** Only one of these three fields is ever correctable in one request -- see Admin::Payments::CorrectionService for exactly why each is restricted this way. */
export type PaymentCorrectionField = 'external_reference' | 'paid_at' | 'status_code';

/**
 * A staff-submitted correction. `expectedUpdatedAt` must be the `updatedAt`
 * from the last detail fetch -- a mismatch means the payment changed since,
 * and the backend rejects the request as stale (409) rather than silently
 * overwriting it. `field`/`value` may be omitted entirely for a "note-only"
 * finding resolution (investigated, no field was actually wrong).
 */
export interface PaymentCorrectionRequest {
  reason: string;
  expectedUpdatedAt: string;
  findingId?: string;
  field?: PaymentCorrectionField;
  value?: string;
}

export type AdminPaymentErrorCode =
  /** 404 -- the payment doesn't exist. */
  | 'NOT_FOUND'
  /** 422 -- a field-level validation failure (blank reason, malformed value/date, unknown finding_id, missing expected_updated_at). */
  | 'VALIDATION_FAILED'
  /** 422, code `payment_correction_not_allowed` -- an unsupported field, an unsupported status transition, or a `status_code` correction to `paid` without a matching open `terminal_event_conflict` finding and real provider evidence. */
  | 'CORRECTION_NOT_ALLOWED'
  /** 409, code `stale_payment` -- the payment changed since `expectedUpdatedAt`. Re-fetch the detail and retry with the new value. */
  | 'STALE_PAYMENT'
  /** 409 -- an identical idempotent request is already processing, or was reused for a different request. */
  | 'CONFLICT'
  /** 400 -- the correction endpoint requires an Idempotency-Key header. */
  | 'MISSING_IDEMPOTENCY_KEY'
  /** 400 -- an unsupported filter or sort parameter (a frontend contract-drift bug, not a user-facing scenario the UI should ever trigger by hand). */
  | 'BAD_REQUEST'
  | 'FORBIDDEN'
  | 'INACTIVE_ACCOUNT'
  | 'SESSION_EXPIRED'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface AdminPaymentError {
  code: AdminPaymentErrorCode;
  /** Already-localized server message, when the backend provided one. */
  message?: string;
  field?: string;
  retryAfterSeconds?: number;
}

export interface AdminPaymentsClient {
  /** The finance workspace's transaction list -- searchable, filterable, sortable, paginated. */
  listPayments(filters: PaymentListFilters, sort: PaymentListSort | undefined, page: PaymentListPage): Promise<PaymentListResult>;

  /** The sole source of truth for one payment's current state, event history and reconciliation findings. */
  getPayment(paymentId: string): Promise<PaymentDetail>;

  /**
   * Applies a correction. `idempotencyKey`, when supplied, is sent as the
   * `Idempotency-Key` header -- the caller generates one fresh key per
   * confirmed submission and reuses it across a retry of that same
   * submission, so a network/server failure followed by "Retry" cannot
   * double-submit (AGENTS.md: "Prevent accidental duplicate mutations").
   * Returns the updated payment detail.
   */
  correctPayment(paymentId: string, correction: PaymentCorrectionRequest, idempotencyKey?: string): Promise<PaymentDetail>;
}

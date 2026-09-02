// Candidate KuickPay/hosted-checkout payment journey (MPS-F601), wired to
// the real backend documented in descon-be's openapi.yaml:
//   GET  /api/v1/candidate/payment
//   POST /api/v1/candidate/payment
//
// The backend is the sole authority on payment status -- nothing here (or
// anywhere downstream) may infer "paid" from a checkout redirect, a URL
// parameter, or the mere existence of a `payment` record. Only
// `payment.status === 'paid'`, read from this endpoint, means paid.

/** Every reason the backend's own EligibilityService can report -- an unrecognized future reason safely falls back to a generic "not eligible right now" message rather than a raw code. */
export type PaymentBlockingReason =
  | 'no_current_assignment'
  | 'payment_stage_not_reached'
  | 'payment_already_completed'
  | 'payment_provider_unavailable'
  | 'required_documents_not_verified'
  | 'unknown';

export type PaymentStatus = 'checkout_pending' | 'paid' | 'failed' | 'cancelled' | 'unknown';

export interface Payment {
  id: string;
  paymentTypeCode: string;
  status: PaymentStatus;
  /** A decimal string (e.g. "1500.00") -- format for display, never parse as a JS number for anything money-related. */
  amount: string;
  currencyCode: string;
  provider: string;
  checkoutUrl: string | null;
  checkoutExpiresAt: string | null;
  paidAt: string | null;
  updatedAt: string | null;
}

export interface PaymentEligibility {
  eligible: boolean;
  /** True only once eligible *and* the provider itself is reachable -- the one flag the "Pay" action should actually gate on. */
  checkoutAvailable: boolean;
  requiredStageCode: string;
  currentStageCode: string | null;
  blockingReasons: PaymentBlockingReason[];
  /** A decimal string -- see `Payment.amount`. */
  amount: string;
  currencyCode: string;
  /** Null only when no checkout has ever been initiated. */
  latestPayment: Payment | null;
}

export type PaymentErrorCode =
  | 'NOT_ELIGIBLE'
  | 'CHECKOUT_UNAVAILABLE'
  | 'IDEMPOTENCY_CONFLICT'
  | 'MISSING_IDEMPOTENCY_KEY'
  | 'INVALID_IDEMPOTENCY_KEY'
  | 'IDEMPOTENCY_IN_PROGRESS'
  | 'INACTIVE_ACCOUNT'
  | 'SESSION_EXPIRED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface PaymentError {
  code: PaymentErrorCode;
  /** The backend's own already-localized message, when present. */
  message?: string;
  /** Only ever present on NOT_ELIGIBLE, mirroring `PaymentEligibility.blockingReasons`. */
  blockingReasons?: PaymentBlockingReason[];
  retryAfterSeconds?: number;
}

export interface InitiateCheckoutResult {
  eligibility: PaymentEligibility;
  payment: Payment;
}

export interface PaymentsClient {
  getEligibility(accessToken: string): Promise<PaymentEligibility>;
  initiateCheckout(accessToken: string, idempotencyKey: string): Promise<InitiateCheckoutResult>;
}

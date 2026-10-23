// Candidate KuickPay/hosted-checkout payment journey (MPS-F601), wired to
// the real backend documented in descon-be's openapi.yaml:
//   GET  /api/v1/candidate/payment
//   POST /api/v1/candidate/payment            (card checkout)
//   POST /api/v1/candidate/payment/voucher    (payment code, paid from a wallet or bank app)
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

export type PaymentMethod = 'voucher' | 'card';

export type PaymentStatus = 'checkout_pending' | 'paid' | 'failed' | 'cancelled' | 'unknown';

export interface Payment {
  id: string;
  paymentTypeCode: string;
  status: PaymentStatus;
  /** A decimal string (e.g. "1500.00") -- format for display, never parse as a JS number for anything money-related. */
  amount: string;
  currencyCode: string;
  /** `kuickpay` is the card checkout, `kuickpay_voucher` a payment code. */
  provider: string;
  checkoutUrl: string | null;
  /** The payment code the candidate pays from a wallet or bank app. Only for `kuickpay_voucher` payments. */
  voucherNumber: string | null;
  /** For a card checkout the session's expiry, for a payment code the date it stops being payable. */
  checkoutExpiresAt: string | null;
  paidAt: string | null;
  updatedAt: string | null;
}

export interface PaymentEligibility {
  eligible: boolean;
  /** True only once eligible *and* the provider itself is reachable -- the one flag the "Pay" action should actually gate on. */
  checkoutAvailable: boolean;
  /** True when the candidate can get a payment code for the fee. */
  voucherAvailable: boolean;
  /** The payment code that is unpaid and not expired, if any. The candidate may have this and a card checkout open at once and chooses which to pay. */
  openVoucher: Payment | null;
  /** True while a card checkout session has not expired. */
  cardCheckoutOpen: boolean;
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
  /** Gives the candidate a payment code for the fee, or returns the open one. */
  createVoucher(accessToken: string, idempotencyKey: string): Promise<InitiateCheckoutResult>;
}

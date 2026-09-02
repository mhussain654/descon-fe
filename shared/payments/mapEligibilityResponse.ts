// Shared response-mapping for the `PaymentEligibility` shape, which the
// backend embeds identically in three places (see descon-be's
// Payments::EligibilitySerializer): GET /candidate/payment,
// GET /candidate/profile's `payment` field, and
// GET /candidate/application_progress's `payment` field. Extracted here so
// realPaymentsClient.ts, realCandidateProfileClient.ts, and
// realApplicationProgressClient.ts all parse it exactly once, the same
// way, rather than duplicating the same field-by-field mapping three times.
import type { Payment, PaymentBlockingReason, PaymentEligibility, PaymentStatus } from './types';

export interface PaymentResponse {
  id: string;
  payment_type_code: string;
  status: string;
  amount: string;
  currency_code: string;
  provider: string;
  checkout_url: string | null;
  checkout_expires_at: string | null;
  paid_at: string | null;
  updated_at: string | null;
}

export interface EligibilityResponse {
  eligible: boolean;
  checkout_available: boolean;
  required_stage_code: string;
  current_stage_code: string | null;
  blocking_reasons: string[];
  amount: string;
  currency_code: string;
  latest_payment: PaymentResponse | null;
}

const KNOWN_STATUSES = new Set<string>(['checkout_pending', 'paid', 'failed', 'cancelled']);

function toStatus(raw: unknown): PaymentStatus {
  return typeof raw === 'string' && KNOWN_STATUSES.has(raw) ? (raw as PaymentStatus) : 'unknown';
}

const KNOWN_BLOCKING_REASONS = new Set<string>([
  'no_current_assignment',
  'payment_stage_not_reached',
  'payment_already_completed',
  'payment_provider_unavailable',
  'required_documents_not_verified',
]);

function toBlockingReason(raw: unknown): PaymentBlockingReason {
  return typeof raw === 'string' && KNOWN_BLOCKING_REASONS.has(raw) ? (raw as PaymentBlockingReason) : 'unknown';
}

export function toBlockingReasons(raw: unknown): PaymentBlockingReason[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(toBlockingReason);
}

export function toPayment(raw: unknown): Payment | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<PaymentResponse>;
  if (typeof value.id !== 'string' || !value.id) return null;

  return {
    id: value.id,
    paymentTypeCode: typeof value.payment_type_code === 'string' ? value.payment_type_code : '',
    status: toStatus(value.status),
    amount: typeof value.amount === 'string' ? value.amount : '0',
    currencyCode: typeof value.currency_code === 'string' ? value.currency_code : '',
    provider: typeof value.provider === 'string' ? value.provider : '',
    checkoutUrl: typeof value.checkout_url === 'string' ? value.checkout_url : null,
    checkoutExpiresAt: typeof value.checkout_expires_at === 'string' ? value.checkout_expires_at : null,
    paidAt: typeof value.paid_at === 'string' ? value.paid_at : null,
    updatedAt: typeof value.updated_at === 'string' ? value.updated_at : null,
  };
}

export function toPaymentEligibility(raw: unknown): PaymentEligibility {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<EligibilityResponse>;

  return {
    eligible: value.eligible === true,
    checkoutAvailable: value.checkout_available === true,
    requiredStageCode: typeof value.required_stage_code === 'string' ? value.required_stage_code : '',
    currentStageCode: typeof value.current_stage_code === 'string' ? value.current_stage_code : null,
    blockingReasons: toBlockingReasons(value.blocking_reasons),
    amount: typeof value.amount === 'string' ? value.amount : '0',
    currencyCode: typeof value.currency_code === 'string' ? value.currency_code : '',
    latestPayment: toPayment(value.latest_payment),
  };
}

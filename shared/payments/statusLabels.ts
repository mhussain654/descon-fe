// Translation-key and tone lookups for payment status and blocking
// reasons, mirroring shared/candidateDocuments/statusLabels.ts's pattern.
import type { PaymentBlockingReason, PaymentStatus } from './types';

export const PAYMENT_STATUS_KEYS: Record<PaymentStatus, string> = {
  checkout_pending: 'paymentStatusCheckoutPending',
  paid: 'paymentStatusPaid',
  failed: 'paymentStatusFailed',
  cancelled: 'paymentStatusCancelled',
  unknown: 'paymentStatusUnknown',
};

export const PAYMENT_STATUS_TONES: Record<PaymentStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  checkout_pending: 'warning',
  paid: 'success',
  failed: 'danger',
  cancelled: 'neutral',
  unknown: 'neutral',
};

export const PAYMENT_BLOCKING_REASON_KEYS: Record<PaymentBlockingReason, string> = {
  no_current_assignment: 'paymentBlockingNoAssignment',
  payment_stage_not_reached: 'paymentBlockingStageNotReached',
  payment_already_completed: 'paymentBlockingAlreadyCompleted',
  payment_provider_unavailable: 'paymentProviderUnavailableError',
  required_documents_not_verified: 'paymentBlockingDocumentsNotVerified',
  unknown: 'paymentBlockingUnknown',
};

/** True once `checkoutExpiresAt` has passed while the payment is still checkout_pending -- the backend has no distinct "expired" status, so this is a pure, frontend-only display derivation, never sent back to the backend or treated as authoritative (a fresh GET /candidate/payment is still the source of truth for whether checkout can be retried). */
export function isCheckoutExpired(status: PaymentStatus, checkoutExpiresAt: string | null, now: Date = new Date()): boolean {
  if (status !== 'checkout_pending' || !checkoutExpiresAt) return false;
  const expiry = new Date(checkoutExpiresAt);
  return !Number.isNaN(expiry.getTime()) && expiry.getTime() <= now.getTime();
}

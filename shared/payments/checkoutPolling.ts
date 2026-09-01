// Live-sync polling while a checkout is pending, matching
// shared/candidateDocuments/pendingReviewPolling.ts's interval and
// rationale exactly: the provider's callback is asynchronous (a
// server-to-server webhook, not something this request triggers), so the
// candidate's own app must periodically re-check GET /candidate/payment to
// notice the eventual paid/failed/cancelled outcome. 20s is frequent
// enough to feel responsive after returning from checkout, conservative
// enough not to meaningfully load the backend, and only runs at all while
// a checkout is actually pending and the screen is in the foreground
// (callers wire `refetchIntervalInBackground: false`).
import type { PaymentEligibility } from './types';

export const CHECKOUT_PENDING_POLL_INTERVAL_MS = 20_000;

export function isCheckoutPending(eligibility: PaymentEligibility | undefined): boolean {
  return eligibility?.latestPayment?.status === 'checkout_pending';
}

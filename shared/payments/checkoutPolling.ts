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

/**
 * A safe upper bound on how long to keep polling automatically. The
 * provider's callback should normally land within seconds, but polling
 * forever would keep hitting the backend indefinitely for a candidate who
 * abandoned checkout or whose callback never arrives -- after this, the
 * caller stops the automatic interval and offers a manual refresh instead
 * (ticket: "Stop polling after a safe timeout and provide manual
 * refresh"). Comfortably shorter than the backend's own checkout session
 * lifetime (`checkout_expires_at`, ~30 minutes by default) so the
 * candidate isn't left auto-polling well past the point the session could
 * plausibly still resolve.
 */
export const CHECKOUT_POLL_TIMEOUT_MS = 5 * 60 * 1000;

export function isCheckoutPending(eligibility: PaymentEligibility | undefined): boolean {
  return eligibility?.latestPayment?.status === 'checkout_pending';
}

/** Pure timeout check so the hook's timer logic is testable without mounting a component. */
export function hasPollingTimedOut(pendingSince: number, now: number): boolean {
  return now - pendingSince >= CHECKOUT_POLL_TIMEOUT_MS;
}

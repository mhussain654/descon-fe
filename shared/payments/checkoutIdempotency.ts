// Pure idempotency-key lifecycle for checkout initiation. Like document
// submission (shared/applicationProgress/submissionIdempotency.ts), a
// checkout request carries no per-attempt selection (its body is always
// empty -- the backend controls amount/currency/provider), so the only
// question is "is this a retry of the current attempt, or a fresh
// intentional one?"

export interface CheckoutIdempotencyKeyState {
  key: string | null;
}

export const EMPTY_CHECKOUT_IDEMPOTENCY_KEY_STATE: CheckoutIdempotencyKeyState = { key: null };

/**
 * Starts a brand-new checkout attempt, always minting a fresh key -- used
 * the first time the candidate presses "Pay," and again after a terminal
 * outcome that must not replay the previous key (an idempotency conflict,
 * or a not-eligible/checkout-unavailable failure the candidate can only
 * resolve by something changing before trying again).
 */
export function beginNewCheckoutAttempt(generateKey: () => string): CheckoutIdempotencyKeyState {
  return { key: generateKey() };
}

/** Reuses the current key when retrying the *same* failed attempt after an offline, timeout, network, or server failure -- mints a new one only if none exists yet. */
export function retryCheckoutAttempt(
  current: CheckoutIdempotencyKeyState,
  generateKey: () => string
): CheckoutIdempotencyKeyState {
  if (current.key) return current;
  return beginNewCheckoutAttempt(generateKey);
}

/** Clears the key after a confirmed successful initiation -- a later, separate attempt must mint a fresh key rather than replaying the now-consumed response. */
export function clearCheckoutIdempotencyKey(): CheckoutIdempotencyKeyState {
  return EMPTY_CHECKOUT_IDEMPOTENCY_KEY_STATE;
}

export function randomCheckoutIdempotencyKey(): string {
  return `candidate-payment-checkout-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

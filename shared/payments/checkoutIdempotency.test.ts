import {
  beginNewCheckoutAttempt,
  clearCheckoutIdempotencyKey,
  EMPTY_CHECKOUT_IDEMPOTENCY_KEY_STATE,
  randomCheckoutIdempotencyKey,
  retryCheckoutAttempt,
} from './checkoutIdempotency';

describe('checkout idempotency-key lifecycle', () => {
  it('mints a fresh key when beginning a new attempt', () => {
    const state = beginNewCheckoutAttempt(() => 'key-1');
    expect(state.key).toBe('key-1');
  });

  it('mints a different key each time a new intentional attempt begins', () => {
    let n = 0;
    const generate = () => `key-${++n}`;
    const first = beginNewCheckoutAttempt(generate);
    const second = beginNewCheckoutAttempt(generate);
    expect(first.key).toBe('key-1');
    expect(second.key).toBe('key-2');
  });

  it('reuses the current key when retrying the same failed attempt', () => {
    const started = beginNewCheckoutAttempt(() => 'key-1');
    const retried = retryCheckoutAttempt(started, () => 'key-2');
    expect(retried.key).toBe('key-1');
  });

  it('mints a key on retry only if none exists yet', () => {
    const retried = retryCheckoutAttempt(EMPTY_CHECKOUT_IDEMPOTENCY_KEY_STATE, () => 'key-1');
    expect(retried.key).toBe('key-1');
  });

  it('clears the key after a confirmed successful initiation', () => {
    const started = beginNewCheckoutAttempt(() => 'key-1');
    const cleared = clearCheckoutIdempotencyKey();
    expect(cleared.key).toBeNull();
    expect(started.key).toBe('key-1');
  });

  it('mints a new key for a fresh attempt after the key was cleared (e.g. an idempotency conflict, or eligibility lost)', () => {
    const cleared = clearCheckoutIdempotencyKey();
    const restarted = beginNewCheckoutAttempt(() => 'key-2');
    expect(cleared.key).toBeNull();
    expect(restarted.key).toBe('key-2');
  });

  it('generates a unique, recognizably-prefixed key', () => {
    const a = randomCheckoutIdempotencyKey();
    const b = randomCheckoutIdempotencyKey();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^candidate-payment-checkout-/);
  });
});

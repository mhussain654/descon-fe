import { CHECKOUT_POLL_TIMEOUT_MS, hasPollingTimedOut, isCheckoutPending } from './checkoutPolling';

describe('isCheckoutPending', () => {
  it('is true only when the latest payment is checkout_pending', () => {
    expect(isCheckoutPending({ latestPayment: { status: 'checkout_pending' } } as never)).toBe(true);
    expect(isCheckoutPending({ latestPayment: { status: 'paid' } } as never)).toBe(false);
    expect(isCheckoutPending({ latestPayment: null } as never)).toBe(false);
    expect(isCheckoutPending(undefined)).toBe(false);
  });
});

describe('hasPollingTimedOut', () => {
  it('is false before the timeout has elapsed', () => {
    const start = 1_000_000;
    expect(hasPollingTimedOut(start, start + CHECKOUT_POLL_TIMEOUT_MS - 1)).toBe(false);
  });

  it('is true once the timeout has elapsed', () => {
    const start = 1_000_000;
    expect(hasPollingTimedOut(start, start + CHECKOUT_POLL_TIMEOUT_MS)).toBe(true);
    expect(hasPollingTimedOut(start, start + CHECKOUT_POLL_TIMEOUT_MS + 60_000)).toBe(true);
  });
});

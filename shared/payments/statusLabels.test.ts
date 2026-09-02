import { isCheckoutExpired } from './statusLabels';

describe('isCheckoutExpired', () => {
  const now = new Date('2026-09-01T12:00:00Z');

  it('is true once checkout_expires_at has passed while still checkout_pending', () => {
    expect(isCheckoutExpired('checkout_pending', '2026-09-01T11:59:00Z', now)).toBe(true);
  });

  it('is false while checkout_expires_at is still in the future', () => {
    expect(isCheckoutExpired('checkout_pending', '2026-09-01T12:01:00Z', now)).toBe(false);
  });

  it('is false for any status other than checkout_pending, even if the timestamp has passed', () => {
    expect(isCheckoutExpired('paid', '2026-09-01T11:59:00Z', now)).toBe(false);
    expect(isCheckoutExpired('failed', '2026-09-01T11:59:00Z', now)).toBe(false);
    expect(isCheckoutExpired('cancelled', '2026-09-01T11:59:00Z', now)).toBe(false);
  });

  it('is false when there is no checkout_expires_at at all', () => {
    expect(isCheckoutExpired('checkout_pending', null, now)).toBe(false);
  });

  it('is false for a malformed timestamp rather than throwing', () => {
    expect(isCheckoutExpired('checkout_pending', 'not-a-date', now)).toBe(false);
  });
});

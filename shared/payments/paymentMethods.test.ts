import { availablePaymentMethods, defaultPaymentMethod, openVoucherPayment } from './paymentMethods';
import type { Payment, PaymentEligibility } from './types';

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'p-1',
    paymentTypeCode: 'onboarding_fee',
    status: 'checkout_pending',
    amount: '1500.0',
    currencyCode: 'PKR',
    provider: 'kuickpay_voucher',
    checkoutUrl: null,
    voucherNumber: '0000832249220',
    checkoutExpiresAt: '2099-11-04T18:59:59Z',
    paidAt: null,
    updatedAt: null,
    ...overrides,
  };
}

function eligibility(overrides: Partial<PaymentEligibility> = {}): PaymentEligibility {
  return {
    eligible: true,
    checkoutAvailable: true,
    voucherAvailable: true,
    openVoucher: null,
    cardCheckoutOpen: false,
    requiredStageCode: 'fee_pending',
    currentStageCode: 'fee_pending',
    blockingReasons: [],
    amount: '1500.0',
    currencyCode: 'PKR',
    latestPayment: null,
    ...overrides,
  };
}

describe('availablePaymentMethods', () => {
  it('offers the payment code first, then the card', () => {
    expect(availablePaymentMethods(eligibility())).toEqual(['voucher', 'card']);
  });

  it('leaves out a way that is not offered', () => {
    expect(availablePaymentMethods(eligibility({ voucherAvailable: false }))).toEqual(['card']);
    expect(availablePaymentMethods(eligibility({ checkoutAvailable: false }))).toEqual(['voucher']);
    expect(availablePaymentMethods(eligibility({ checkoutAvailable: false, voucherAvailable: false }))).toEqual([]);
  });

  it('keeps a way that is already open even if it is no longer offered', () => {
    expect(availablePaymentMethods(eligibility({ voucherAvailable: false, checkoutAvailable: false, openVoucher: payment() }))).toEqual(['voucher']);
    expect(availablePaymentMethods(eligibility({ voucherAvailable: false, checkoutAvailable: false, cardCheckoutOpen: true }))).toEqual(['card']);
  });

  it('offers both ways at once, even when one of them is already open', () => {
    expect(availablePaymentMethods(eligibility({ openVoucher: payment() }))).toEqual(['voucher', 'card']);
    expect(availablePaymentMethods(eligibility({ cardCheckoutOpen: true }))).toEqual(['voucher', 'card']);
  });
});

describe('defaultPaymentMethod', () => {
  it('opens on the payment code', () => {
    expect(defaultPaymentMethod(eligibility())).toBe('voucher');
    expect(defaultPaymentMethod(eligibility({ openVoucher: payment() }))).toBe('voucher');
  });

  it('opens on the card when only the card is offered', () => {
    expect(defaultPaymentMethod(eligibility({ voucherAvailable: false }))).toBe('card');
  });

  it('opens on the card when a card checkout is in progress and no code is open', () => {
    expect(defaultPaymentMethod(eligibility({ cardCheckoutOpen: true }))).toBe('card');
    expect(defaultPaymentMethod(eligibility({ cardCheckoutOpen: true, openVoucher: payment() }))).toBe('voucher');
  });
});

describe('openVoucherPayment', () => {
  const now = new Date('2026-10-21T10:00:00Z');

  it('returns the open code', () => {
    expect(openVoucherPayment(eligibility({ openVoucher: payment() }), now)?.voucherNumber).toBe('0000832249220');
  });

  it('returns nothing when there is no code, it is paid, or its expiry has passed on this device', () => {
    expect(openVoucherPayment(eligibility(), now)).toBeNull();
    expect(openVoucherPayment(eligibility({ openVoucher: payment({ status: 'paid' }) }), now)).toBeNull();
    expect(openVoucherPayment(eligibility({ openVoucher: payment({ checkoutExpiresAt: '2026-10-20T10:00:00Z' }) }), now)).toBeNull();
  });
});

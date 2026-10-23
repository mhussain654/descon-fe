// Which ways of paying the fee the candidate is offered, and which one is
// shown first -- shared by web and mobile so both show the same choices.
// The candidate may have a payment code and a card checkout open at the same
// time and chooses which to pay (the screen warns them to pay only one); if both
// ever get paid, reconciliation flags it for finance.
import { isCheckoutExpired } from './statusLabels';
import type { Payment, PaymentEligibility, PaymentMethod } from './types';

/** The payment code waiting to be paid: unpaid, and not past its expiry by this device's clock either. */
export function openVoucherPayment(eligibility: PaymentEligibility, now: Date = new Date()): Payment | null {
  const voucher = eligibility.openVoucher ?? null;
  if (!voucher || voucher.status !== 'checkout_pending') return null;
  return isCheckoutExpired(voucher.status, voucher.checkoutExpiresAt, now) ? null : voucher;
}

/** The tabs to show, payment code first. A way that is not offered, and not already open, is left out. */
export function availablePaymentMethods(eligibility: PaymentEligibility): PaymentMethod[] {
  const methods: PaymentMethod[] = [];
  if (eligibility.voucherAvailable || openVoucherPayment(eligibility)) methods.push('voucher');
  if (eligibility.checkoutAvailable || eligibility.cardCheckoutOpen) methods.push('card');
  return methods;
}

/** The payment code is the default; the card opens first when only it is offered, or when a card checkout is already in progress and no code is open. */
export function defaultPaymentMethod(eligibility: PaymentEligibility): PaymentMethod {
  const methods = availablePaymentMethods(eligibility);
  if (eligibility.cardCheckoutOpen && !openVoucherPayment(eligibility)) return 'card';
  return methods.includes('voucher') ? 'voucher' : (methods[0] ?? 'voucher');
}

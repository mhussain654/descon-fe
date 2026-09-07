import { isHostedCheckoutReturnUrl } from './hostedCheckoutReturn';

const API_BASE_URL = 'https://4e24-2400-adc5.ngrok-free.app/api/v1';

describe('isHostedCheckoutReturnUrl', () => {
  it('is true once navigation reaches the hosted checkout return endpoint', () => {
    expect(isHostedCheckoutReturnUrl(`${API_BASE_URL}/payments/hosted_checkout/kuickpay/return`, API_BASE_URL)).toBe(true);
  });

  it('is false for the provider checkout page itself', () => {
    expect(isHostedCheckoutReturnUrl('https://sandbox-api.kuickpay.com/api/session?token=abc', API_BASE_URL)).toBe(false);
  });

  it('is false for an unrelated path on our own backend', () => {
    expect(isHostedCheckoutReturnUrl(`${API_BASE_URL}/candidate/payment`, API_BASE_URL)).toBe(false);
  });

  it('is false when the API base URL is not configured', () => {
    expect(isHostedCheckoutReturnUrl(`${API_BASE_URL}/payments/hosted_checkout/kuickpay/return`, '')).toBe(false);
  });
});

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

  it('is false when the navigating URL is unparseable', () => {
    expect(isHostedCheckoutReturnUrl('not-a-url', API_BASE_URL)).toBe(false);
  });

  it('is false when the API base URL is unparseable', () => {
    expect(isHostedCheckoutReturnUrl(`${API_BASE_URL}/payments/hosted_checkout/kuickpay/return`, 'not-a-url')).toBe(false);
  });

  describe('lookalike/malicious navigating URLs (security regression)', () => {
    it('is false for a lookalike domain that merely starts with the real API base URL', () => {
      // "https://<real-host>.evil.example" legitimately starts with
      // "https://<real-host>" as a string -- this is exactly what a plain
      // startsWith() check would wrongly accept.
      expect(
        isHostedCheckoutReturnUrl(
          'https://4e24-2400-adc5.ngrok-free.app.evil.example/api/v1/payments/hosted_checkout/kuickpay/return',
          API_BASE_URL
        )
      ).toBe(false);
    });

    it('is false for a subdomain lookalike of the real API host', () => {
      expect(
        isHostedCheckoutReturnUrl(
          'https://evil.4e24-2400-adc5.ngrok-free.app/api/v1/payments/hosted_checkout/kuickpay/return',
          API_BASE_URL
        )
      ).toBe(false);
    });

    it('is false for a protocol downgrade to plain HTTP on an otherwise-matching host', () => {
      const httpUrl = API_BASE_URL.replace('https://', 'http://');
      expect(isHostedCheckoutReturnUrl(`${httpUrl}/payments/hosted_checkout/kuickpay/return`, API_BASE_URL)).toBe(false);
    });

    it('is false when the navigating URL embeds credentials before the real host', () => {
      const withCredentials = API_BASE_URL.replace('https://', 'https://attacker:pw@');
      expect(isHostedCheckoutReturnUrl(`${withCredentials}/payments/hosted_checkout/kuickpay/return`, API_BASE_URL)).toBe(false);
    });

    it('is false for a protocol-relative URL that resolves to a different host', () => {
      expect(isHostedCheckoutReturnUrl('https://evil.example/payments/hosted_checkout/kuickpay/return', API_BASE_URL)).toBe(false);
    });

    it('is false when a dot-segment path resolves outside the return pattern', () => {
      expect(isHostedCheckoutReturnUrl(`${API_BASE_URL}/payments/hosted_checkout/kuickpay/return/../../admin`, API_BASE_URL)).toBe(
        false
      );
    });

    it('is false when a dot-segment path resolves to the callback endpoint instead of return', () => {
      expect(isHostedCheckoutReturnUrl(`${API_BASE_URL}/payments/hosted_checkout/../callback/return`, API_BASE_URL)).toBe(false);
    });

    it('is true for the return path with a trailing slash', () => {
      expect(isHostedCheckoutReturnUrl(`${API_BASE_URL}/payments/hosted_checkout/kuickpay/return/`, API_BASE_URL)).toBe(true);
    });

    it('is true regardless of query-string content appended to the return path', () => {
      expect(
        isHostedCheckoutReturnUrl(`${API_BASE_URL}/payments/hosted_checkout/kuickpay/return?status=success`, API_BASE_URL)
      ).toBe(true);
    });
  });
});

// Runs under both web's Vitest and mobile's Jest, matching
// shared/applicationProgress/realApplicationProgressClient.test.ts's pattern.
import { createApiClient } from '../api-client';
import { createPaymentsClient } from './realPaymentsClient';

const originalFetch = globalThis.fetch;
function stubFetch(impl: typeof fetch) {
  globalThis.fetch = impl as typeof fetch;
}
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function successEnvelope(data: unknown) {
  return { data, meta: { request_id: 'req-1', timestamp: '2026-08-31T09:00:00Z' }, errors: [] };
}

function errorEnvelope(errors: Array<{ code: string; message: string; details?: unknown }>) {
  return { errors, request_id: 'req-1', timestamp: '2026-08-31T09:00:00Z' };
}

function paymentPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bbe3e0b4-9237-4e8d-9bd7-04fe0e9ce8dd',
    payment_type_code: 'onboarding_fee',
    status: 'checkout_pending',
    amount: '1500.0',
    currency_code: 'PKR',
    provider: 'mock_hosted_checkout',
    checkout_url: 'https://mock-payments.example.test/checkout?orderid=PAY-DES-001001-ABC123',
    checkout_expires_at: '2026-08-31T09:30:00Z',
    paid_at: null,
    updated_at: '2026-08-31T09:00:00Z',
    ...overrides,
  };
}

function eligibilityPayload(overrides: Record<string, unknown> = {}) {
  return {
    eligible: true,
    checkout_available: true,
    required_stage_code: 'fee_pending',
    current_stage_code: 'fee_pending',
    blocking_reasons: [],
    amount: '1500.0',
    currency_code: 'PKR',
    latest_payment: null,
    ...overrides,
  };
}

function buildClient(locale: 'en' | 'ur' = 'en') {
  const apiClient = createApiClient({ baseUrl: 'http://example.test/api/v1' });
  return createPaymentsClient({ apiClient, getLocale: () => locale });
}

describe('createPaymentsClient (real)', () => {
  describe('getEligibility', () => {
    it('maps a blocked-before-fee eligibility with no latest payment', async () => {
      let capturedUrl: string | undefined;
      let capturedHeaders: Record<string, string> | undefined;
      stubFetch(async (url, init) => {
        capturedUrl = String(url);
        capturedHeaders = init?.headers as Record<string, string>;
        return jsonResponse(
          successEnvelope(
            eligibilityPayload({
              eligible: false,
              checkout_available: false,
              current_stage_code: 'documents_uploaded',
              blocking_reasons: ['payment_stage_not_reached'],
            })
          )
        );
      });
      const client = buildClient('ur');

      const result = await client.getEligibility('candidate-token');

      expect(capturedUrl).toContain('/candidate/payment');
      expect(capturedHeaders?.Authorization).toBe('Bearer candidate-token');
      expect(capturedHeaders?.['X-Locale']).toBe('ur');
      expect(result).toEqual({
        eligible: false,
        checkoutAvailable: false,
        requiredStageCode: 'fee_pending',
        currentStageCode: 'documents_uploaded',
        blockingReasons: ['payment_stage_not_reached'],
        amount: '1500.0',
        currencyCode: 'PKR',
        latestPayment: null,
      });
    });

    it('maps an eligible state with a pending latest payment', async () => {
      stubFetch(async () => jsonResponse(successEnvelope(eligibilityPayload({ latest_payment: paymentPayload() }))));
      const client = buildClient();

      const result = await client.getEligibility('candidate-token');

      expect(result.latestPayment).toEqual({
        id: 'bbe3e0b4-9237-4e8d-9bd7-04fe0e9ce8dd',
        paymentTypeCode: 'onboarding_fee',
        status: 'checkout_pending',
        amount: '1500.0',
        currencyCode: 'PKR',
        provider: 'mock_hosted_checkout',
        checkoutUrl: 'https://mock-payments.example.test/checkout?orderid=PAY-DES-001001-ABC123',
        checkoutExpiresAt: '2026-08-31T09:30:00Z',
        paidAt: null,
        updatedAt: '2026-08-31T09:00:00Z',
      });
    });

    it('falls back to unknown for an unrecognized status or blocking reason, never crashing', async () => {
      stubFetch(async () =>
        jsonResponse(
          successEnvelope(
            eligibilityPayload({
              blocking_reasons: ['some_future_reason'],
              latest_payment: paymentPayload({ status: 'some_future_status' }),
            })
          )
        )
      );
      const client = buildClient();

      const result = await client.getEligibility('candidate-token');

      expect(result.blockingReasons).toEqual(['unknown']);
      expect(result.latestPayment?.status).toBe('unknown');
    });

    it('maps a 401 to SESSION_EXPIRED', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'unauthorized', message: 'no' }]), { status: 401 }));
      const client = buildClient();

      await expect(client.getEligibility('bad-token')).rejects.toEqual({ code: 'SESSION_EXPIRED', message: undefined });
    });
  });

  describe('initiateCheckout', () => {
    it('sends no request body and the Idempotency-Key header', async () => {
      let capturedBody: string | null | undefined;
      let capturedHeaders: Record<string, string> | undefined;
      stubFetch(async (_url, init) => {
        capturedBody = init?.body as string | null | undefined;
        capturedHeaders = init?.headers as Record<string, string>;
        return jsonResponse(
          successEnvelope({ eligibility: eligibilityPayload({ latest_payment: paymentPayload() }), payment: paymentPayload() }),
          { status: 201 }
        );
      });
      const client = buildClient();

      const result = await client.initiateCheckout('candidate-token', 'idem-checkout-1');

      expect(capturedBody == null).toBe(true);
      expect(capturedHeaders?.['Idempotency-Key']).toBe('idem-checkout-1');
      expect(result.payment.status).toBe('checkout_pending');
      expect(result.payment.checkoutUrl).toContain('mock-payments.example.test');
      expect(result.eligibility.latestPayment).not.toBeNull();
    });

    it('maps a not-eligible 422 with its blocking reasons', async () => {
      stubFetch(async () =>
        jsonResponse(
          errorEnvelope([
            {
              code: 'payment_not_eligible',
              message: 'This candidate is not eligible to start payment.',
              details: { blocking_reasons: ['required_documents_not_verified'] },
            },
          ]),
          { status: 422 }
        )
      );
      const client = buildClient();

      await expect(client.initiateCheckout('candidate-token', 'idem-checkout-2')).rejects.toEqual({
        code: 'NOT_ELIGIBLE',
        message: 'This candidate is not eligible to start payment.',
        blockingReasons: ['required_documents_not_verified'],
      });
    });

    it('maps a 503 provider-unavailable error', async () => {
      stubFetch(async () =>
        jsonResponse(errorEnvelope([{ code: 'x', message: 'Hosted checkout is not available right now.' }]), { status: 503 })
      );
      const client = buildClient();

      await expect(client.initiateCheckout('candidate-token', 'idem-checkout-3')).rejects.toEqual({
        code: 'CHECKOUT_UNAVAILABLE',
        message: 'Hosted checkout is not available right now.',
      });
    });

    it('maps a 409 idempotency conflict', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'x', message: 'conflict' }]), { status: 409 }));
      const client = buildClient();

      await expect(client.initiateCheckout('candidate-token', 'idem-checkout-4')).rejects.toEqual({
        code: 'IDEMPOTENCY_CONFLICT',
        message: 'conflict',
      });
    });
  });
});

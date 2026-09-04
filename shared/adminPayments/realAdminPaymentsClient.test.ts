import { createApiClient } from '../api-client';
import type { StaffAuthClient } from '../auth/staffTypes';
import { createAdminPaymentsClient } from './realAdminPaymentsClient';

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

function successEnvelope(data: unknown, meta: Record<string, unknown> = {}) {
  return { data, meta: { request_id: 'req-1', timestamp: '2026-09-03T09:00:00Z', ...meta }, errors: [] };
}

function errorEnvelope(errors: Array<{ code: string; message: string; field?: string }>) {
  return { errors, request_id: 'req-1' };
}

function paymentPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 'payment-1',
    candidate: { id: 'candidate-1', full_name: 'Ahmed Ali', masked_cnic: '42101-*******-1', reference_number: 'DES-001001' },
    payment_type_code: 'onboarding_fee',
    status: 'paid',
    amount: '1500.00',
    currency_code: 'PKR',
    provider: 'kuickpay',
    external_reference: 'KP-77889900',
    reconciliation_state: 'clean',
    paid_at: '2026-09-01T10:05:00Z',
    created_at: '2026-09-01T10:00:00Z',
    updated_at: '2026-09-01T10:05:00Z',
    ...overrides,
  };
}

function paymentDetailPayload(overrides: Record<string, unknown> = {}) {
  return {
    ...paymentPayload(),
    payment_events: [
      {
        id: 'evt-1',
        event_type: 'payment_succeeded',
        event_source: 'callback',
        provider_status_code: 'SUCCESS',
        occurred_at: '2026-09-01T10:05:00Z',
        actor: null,
      },
    ],
    reconciliation_findings: [],
    ...overrides,
  };
}

/** A fake StaffAuthClient that just attaches a fixed token and rethrows whatever `makeRequest` throws -- authenticatedDataRequest's own refresh/401 behavior is covered separately in realStaffAuthClient.test.ts. */
function fakeStaffAuthClient(): StaffAuthClient {
  return {
    signIn: async () => {
      throw new Error('not used');
    },
    restoreSession: async () => null,
    signOut: async () => undefined,
    authenticatedRequest: async () => {
      throw new Error('not used');
    },
    authenticatedDataRequest: async (makeRequest) => makeRequest('staff-access-token'),
  };
}

function buildClient(locale: 'en' | 'ur' = 'en') {
  const apiClient = createApiClient({ baseUrl: 'http://example.test/api/v1' });
  const staffAuthClient = fakeStaffAuthClient();
  const client = createAdminPaymentsClient({ apiClient, staffAuthClient, getLocale: () => locale });
  return { client };
}

describe('createAdminPaymentsClient (real)', () => {
  describe('listPayments', () => {
    it('fetches the real backend list with auth/locale headers and maps the response', async () => {
      let seenUrl = '';
      let seenInit: RequestInit | undefined;
      stubFetch(async (url, init) => {
        seenUrl = String(url);
        seenInit = init as RequestInit;
        return jsonResponse(
          successEnvelope([paymentPayload()], {
            pagination: { page: 1, per_page: 20, total_count: 1, total_pages: 1 },
            applied_filters: { status: 'paid' },
          })
        );
      });

      const { client } = buildClient('ur');
      const result = await client.listPayments({ status: 'paid' }, '-created_at', { number: 1, size: 20 });

      expect(seenUrl).toBe(
        'http://example.test/api/v1/admin/payments?filter%5Bstatus%5D=paid&sort=-created_at&page%5Bnumber%5D=1&page%5Bsize%5D=20'
      );
      const headers = seenInit?.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer staff-access-token');
      expect(headers['X-Locale']).toBe('ur');

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({
        id: 'payment-1',
        candidate: { id: 'candidate-1', fullName: 'Ahmed Ali', maskedCnic: '42101-*******-1', referenceNumber: 'DES-001001' },
        paymentTypeCode: 'onboarding_fee',
        status: 'paid',
        amount: '1500.00',
        currencyCode: 'PKR',
        provider: 'kuickpay',
        externalReference: 'KP-77889900',
        reconciliationState: 'clean',
        paidAt: '2026-09-01T10:05:00Z',
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:05:00Z',
      });
      expect(result.pagination).toEqual({ page: 1, perPage: 20, totalCount: 1, totalPages: 1 });
      expect(result.appliedFilters).toEqual({ status: 'paid' });
    });

    it('never exposes a raw CNIC, only the masked one', async () => {
      stubFetch(async () => jsonResponse(successEnvelope([paymentPayload()])));
      const { client } = buildClient();

      const result = await client.listPayments({}, undefined, {});

      expect(JSON.stringify(result)).not.toMatch(/\d{5}-\d{7}-\d/);
      expect(result.items[0].candidate.maskedCnic).toBe('42101-*******-1');
    });

    it('maps a 403 with inactive_account to INACTIVE_ACCOUNT, distinct from a generic FORBIDDEN', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'inactive_account', message: 'Inactive.' }]), { status: 403 }));
      const { client } = buildClient();

      await expect(client.listPayments({}, undefined, {})).rejects.toMatchObject({ code: 'INACTIVE_ACCOUNT' });
    });

    it('maps an ordinary 403 to FORBIDDEN', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'forbidden', message: 'Not permitted.' }]), { status: 403 }));
      const { client } = buildClient();

      await expect(client.listPayments({}, undefined, {})).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('maps a 400 unsupported_filter to BAD_REQUEST', async () => {
      stubFetch(async () =>
        jsonResponse(errorEnvelope([{ code: 'unsupported_filter', message: 'Unsupported filter.', field: 'filter.bogus' }]), {
          status: 400,
        })
      );
      const { client } = buildClient();

      await expect(client.listPayments({}, undefined, {})).rejects.toMatchObject({ code: 'BAD_REQUEST', field: 'filter.bogus' });
    });
  });

  describe('getPayment', () => {
    it('fetches one payment detail with safe events and reconciliation findings', async () => {
      let seenUrl = '';
      stubFetch(async (url) => {
        seenUrl = String(url);
        return jsonResponse(successEnvelope(paymentDetailPayload()));
      });
      const { client } = buildClient();

      const result = await client.getPayment('payment-1');

      expect(seenUrl).toBe('http://example.test/api/v1/admin/payments/payment-1');
      expect(result.paymentEvents).toEqual([
        { id: 'evt-1', eventType: 'payment_succeeded', eventSource: 'callback', providerStatusCode: 'SUCCESS', occurredAt: '2026-09-01T10:05:00Z' },
      ]);
      expect(result.reconciliationFindings).toEqual([]);
    });

    it('maps a resolved finding with its resolver', async () => {
      stubFetch(async () =>
        jsonResponse(
          successEnvelope(
            paymentDetailPayload({
              reconciliation_findings: [
                {
                  id: 'finding-1',
                  finding_code: 'external_reference_missing',
                  state: 'resolved',
                  resolved_at: '2026-09-02T09:00:00Z',
                  resolved_by: { id: 'staff-1', role: 'finance' },
                  resolution_note: 'Backfilled from provider dashboard.',
                  created_at: '2026-09-01T12:00:00Z',
                },
              ],
            })
          )
        )
      );
      const { client } = buildClient();

      const result = await client.getPayment('payment-1');

      expect(result.reconciliationFindings[0]).toEqual({
        id: 'finding-1',
        findingCode: 'external_reference_missing',
        state: 'resolved',
        resolvedAt: '2026-09-02T09:00:00Z',
        resolvedBy: { id: 'staff-1', role: 'finance' },
        resolutionNote: 'Backfilled from provider dashboard.',
        createdAt: '2026-09-01T12:00:00Z',
      });
    });

    it('maps a 404 to NOT_FOUND', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'payment_not_found', message: 'Payment not found.' }]), { status: 404 }));
      const { client } = buildClient();

      await expect(client.getPayment('missing')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('maps SESSION_EXPIRED from a StaffAuthError straight through', async () => {
      const apiClient = createApiClient({ baseUrl: 'http://example.test/api/v1' });
      const staffAuthClient: StaffAuthClient = {
        signIn: async () => {
          throw new Error('not used');
        },
        restoreSession: async () => null,
        signOut: async () => undefined,
        authenticatedRequest: async () => {
          throw new Error('not used');
        },
        authenticatedDataRequest: async () => {
          throw { code: 'SESSION_EXPIRED' };
        },
      };
      const client = createAdminPaymentsClient({ apiClient, staffAuthClient, getLocale: () => 'en' });

      await expect(client.getPayment('payment-1')).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
    });
  });

  describe('correctPayment', () => {
    it('sends the correction body with the Idempotency-Key header and returns the updated detail', async () => {
      let seenUrl = '';
      let seenInit: RequestInit | undefined;
      stubFetch(async (url, init) => {
        seenUrl = String(url);
        seenInit = init as RequestInit;
        return jsonResponse(successEnvelope(paymentDetailPayload({ external_reference: 'EXT-NEW' })), { status: 201 });
      });
      const { client } = buildClient();

      const result = await client.correctPayment(
        'payment-1',
        { reason: 'Backfilling.', expectedUpdatedAt: '2026-09-01T10:05:00Z', field: 'external_reference', value: 'EXT-NEW' },
        'correction-key-1'
      );

      expect(seenUrl).toBe('http://example.test/api/v1/admin/payments/payment-1/corrections');
      const headers = seenInit?.headers as Record<string, string>;
      expect(headers['Idempotency-Key']).toBe('correction-key-1');
      const body = JSON.parse(seenInit?.body as string);
      expect(body).toEqual({
        correction: {
          reason: 'Backfilling.',
          expected_updated_at: '2026-09-01T10:05:00Z',
          finding_id: undefined,
          field: 'external_reference',
          value: 'EXT-NEW',
        },
      });
      expect(result.externalReference).toBe('EXT-NEW');
    });

    it('omits the Idempotency-Key header when none is supplied', async () => {
      let seenInit: RequestInit | undefined;
      stubFetch(async (_url, init) => {
        seenInit = init as RequestInit;
        return jsonResponse(successEnvelope(paymentDetailPayload()), { status: 201 });
      });
      const { client } = buildClient();

      await client.correctPayment('payment-1', { reason: 'x', expectedUpdatedAt: '2026-09-01T10:05:00Z' });

      const headers = seenInit?.headers as Record<string, string>;
      expect(headers['Idempotency-Key']).toBeUndefined();
    });

    it('maps a 409 stale_payment to STALE_PAYMENT', async () => {
      stubFetch(async () =>
        jsonResponse(errorEnvelope([{ code: 'stale_payment', message: 'This payment changed before this correction could be applied.' }]), {
          status: 409,
        })
      );
      const { client } = buildClient();

      await expect(
        client.correctPayment('payment-1', { reason: 'x', expectedUpdatedAt: '2026-09-01T10:05:00Z', field: 'external_reference', value: 'x' })
      ).rejects.toMatchObject({ code: 'STALE_PAYMENT' });
    });

    it('maps a different 409 (idempotency conflict) to CONFLICT, distinct from STALE_PAYMENT', async () => {
      stubFetch(async () =>
        jsonResponse(errorEnvelope([{ code: 'idempotency_conflict', message: 'Already processing.' }]), { status: 409 })
      );
      const { client } = buildClient();

      await expect(
        client.correctPayment('payment-1', { reason: 'x', expectedUpdatedAt: '2026-09-01T10:05:00Z' })
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('maps a 422 payment_correction_not_allowed to CORRECTION_NOT_ALLOWED with its field', async () => {
      stubFetch(async () =>
        jsonResponse(
          errorEnvelope([{ code: 'payment_correction_not_allowed', message: 'Not allowed.', field: 'correction.value' }]),
          { status: 422 }
        )
      );
      const { client } = buildClient();

      await expect(
        client.correctPayment('payment-1', { reason: 'x', expectedUpdatedAt: '2026-09-01T10:05:00Z', field: 'status_code', value: 'paid' })
      ).rejects.toMatchObject({ code: 'CORRECTION_NOT_ALLOWED', field: 'correction.value' });
    });

    it('maps a generic 422 to VALIDATION_FAILED', async () => {
      stubFetch(async () =>
        jsonResponse(errorEnvelope([{ code: 'validation_failed', message: 'Enter a reason.', field: 'correction.reason' }]), {
          status: 422,
        })
      );
      const { client } = buildClient();

      await expect(client.correctPayment('payment-1', { reason: '', expectedUpdatedAt: '2026-09-01T10:05:00Z' })).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        field: 'correction.reason',
      });
    });

    it('maps a 400 missing_idempotency_key to MISSING_IDEMPOTENCY_KEY', async () => {
      stubFetch(async () =>
        jsonResponse(errorEnvelope([{ code: 'missing_idempotency_key', message: 'Idempotency-Key required.' }]), { status: 400 })
      );
      const { client } = buildClient();

      await expect(client.correctPayment('payment-1', { reason: 'x', expectedUpdatedAt: '2026-09-01T10:05:00Z' })).rejects.toMatchObject({
        code: 'MISSING_IDEMPOTENCY_KEY',
      });
    });

    it('maps a 5xx to SERVER_ERROR', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'internal_server_error', message: 'Boom.' }]), { status: 500 }));
      const { client } = buildClient();

      await expect(client.correctPayment('payment-1', { reason: 'x', expectedUpdatedAt: '2026-09-01T10:05:00Z' })).rejects.toMatchObject({
        code: 'SERVER_ERROR',
      });
    });
  });
});

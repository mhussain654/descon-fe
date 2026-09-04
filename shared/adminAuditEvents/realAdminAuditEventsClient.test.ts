import { createApiClient } from '../api-client';
import type { StaffAuthClient } from '../auth/staffTypes';
import { createAdminAuditEventsClient } from './realAdminAuditEventsClient';

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
  return { data, meta: { request_id: 'req-1', timestamp: '2026-09-04T09:00:00Z', ...meta }, errors: [] };
}

function errorEnvelope(errors: Array<{ code: string; message: string; field?: string }>) {
  return { errors, request_id: 'req-1' };
}

function auditEventPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 4821,
    actor: { id: 'bbe3e0b4-9237-4e8d-9bd7-04fe0e9ce8dd', role: 'admin' },
    action_code: 'candidate_document_verified',
    entity_type: 'CandidateDocument',
    entity_id: 991,
    candidate_id: 'd8805480-7d1b-4ef4-aee6-c76dd026e3e4',
    reason_code: null,
    note: null,
    request_id: 'req-1',
    occurred_at: '2026-09-01T10:05:00Z',
    metadata: { candidate_public_id: 'd8805480-7d1b-4ef4-aee6-c76dd026e3e4' },
    ...overrides,
  };
}

/** A fake StaffAuthClient that just attaches a fixed token and rethrows whatever `makeRequest` throws -- authenticatedDataRequest's own refresh/401 behavior is covered separately in realStaffAuthClient.test.ts (same rationale as realAdminPaymentsClient.test.ts's identical fake). */
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
  const client = createAdminAuditEventsClient({ apiClient, staffAuthClient, getLocale: () => locale });
  return { client };
}

describe('createAdminAuditEventsClient (real)', () => {
  describe('listAuditEvents', () => {
    it('fetches the real backend list with auth/locale headers and maps the response', async () => {
      let seenUrl = '';
      let seenInit: RequestInit | undefined;
      stubFetch(async (url, init) => {
        seenUrl = String(url);
        seenInit = init as RequestInit;
        return jsonResponse(
          successEnvelope([auditEventPayload()], {
            pagination: { page: 1, per_page: 20, total_count: 1, total_pages: 1 },
            applied_filters: { entity_type: 'CandidateDocument' },
          })
        );
      });

      const { client } = buildClient('ur');
      const result = await client.listAuditEvents(
        { actor: 'a1', action: 'candidate_document_verified,payment_corrected', entityType: 'CandidateDocument', candidate: 'c1', occurredFrom: '2026-08-01', occurredTo: '2026-08-31' },
        'occurred_at',
        { number: 1, size: 20 }
      );

      expect(seenUrl).toBe(
        'http://example.test/api/v1/admin/audit_events?filter%5Bactor%5D=a1&filter%5Baction%5D=candidate_document_verified%2Cpayment_corrected' +
          '&filter%5Bentity_type%5D=CandidateDocument&filter%5Bcandidate%5D=c1&filter%5Boccurred_from%5D=2026-08-01' +
          '&filter%5Boccurred_to%5D=2026-08-31&sort=occurred_at&page%5Bnumber%5D=1&page%5Bsize%5D=20'
      );
      const headers = seenInit?.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer staff-access-token');
      expect(headers['X-Locale']).toBe('ur');

      expect(result.items).toEqual([
        {
          id: 4821,
          actor: { id: 'bbe3e0b4-9237-4e8d-9bd7-04fe0e9ce8dd', role: 'admin' },
          actionCode: 'candidate_document_verified',
          entityType: 'CandidateDocument',
          entityId: 991,
          candidateId: 'd8805480-7d1b-4ef4-aee6-c76dd026e3e4',
          reasonCode: undefined,
          note: undefined,
          requestId: 'req-1',
          occurredAt: '2026-09-01T10:05:00Z',
          metadata: { candidate_public_id: 'd8805480-7d1b-4ef4-aee6-c76dd026e3e4' },
        },
      ]);
      expect(result.pagination).toEqual({ page: 1, perPage: 20, totalCount: 1, totalPages: 1 });
      expect(result.appliedFilters).toEqual({ entity_type: 'CandidateDocument' });
    });

    it('maps an absent actor to undefined, not null, for a system-triggered event', async () => {
      stubFetch(async () => jsonResponse(successEnvelope([auditEventPayload({ actor: null })])));
      const { client } = buildClient();

      const result = await client.listAuditEvents({}, undefined, {});

      expect(result.items[0].actor).toBeUndefined();
    });

    it('fetches with no filters when none are supplied', async () => {
      let seenUrl = '';
      stubFetch(async (url) => {
        seenUrl = String(url);
        return jsonResponse(successEnvelope([]));
      });
      const { client } = buildClient();

      await client.listAuditEvents({}, undefined, {});

      expect(seenUrl).toBe('http://example.test/api/v1/admin/audit_events');
    });

    it('maps a 400 unsupported filter to BAD_REQUEST with its field', async () => {
      stubFetch(async () =>
        jsonResponse(errorEnvelope([{ code: 'unsupported_filter', message: 'Unsupported filter.', field: 'filter.bogus' }]), { status: 400 })
      );
      const { client } = buildClient();

      await expect(client.listAuditEvents({}, undefined, {})).rejects.toMatchObject({ code: 'BAD_REQUEST', field: 'filter.bogus' });
    });

    it('maps an ordinary 403 to FORBIDDEN', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'forbidden', message: 'Not permitted.' }]), { status: 403 }));
      const { client } = buildClient();

      await expect(client.listAuditEvents({}, undefined, {})).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('maps a 403 with inactive_account to INACTIVE_ACCOUNT, distinct from a generic FORBIDDEN', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'inactive_account', message: 'Inactive.' }]), { status: 403 }));
      const { client } = buildClient();

      await expect(client.listAuditEvents({}, undefined, {})).rejects.toMatchObject({ code: 'INACTIVE_ACCOUNT' });
    });

    it('maps a 5xx to SERVER_ERROR', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'internal_server_error', message: 'Boom.' }]), { status: 500 }));
      const { client } = buildClient();

      await expect(client.listAuditEvents({}, undefined, {})).rejects.toMatchObject({ code: 'SERVER_ERROR' });
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
      const client = createAdminAuditEventsClient({ apiClient, staffAuthClient, getLocale: () => 'en' });

      await expect(client.listAuditEvents({}, undefined, {})).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
    });
  });
});

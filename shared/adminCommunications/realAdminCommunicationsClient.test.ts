import { createApiClient } from '../api-client';
import type { StaffAuthClient } from '../auth/staffTypes';
import { createAdminCommunicationsClient } from './realAdminCommunicationsClient';

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
  return { data, meta: { request_id: 'req-1', timestamp: '2026-09-11T09:00:00Z', ...meta }, errors: [] };
}

function errorEnvelope(errors: Array<{ code: string; message: string; field?: string }>) {
  return { errors, request_id: 'req-1' };
}

function communicationPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: '2a6f9c4e-9a3e-4f0e-9a0a-5a6f9c4e9a3e',
    channel_code: 'ai_voice_call',
    direction_code: 'outbound',
    status_code: 'completed',
    template_code: null,
    locale: 'en',
    candidate_assignment: {
      id: 'd8805480-7d1b-4ef4-aee6-c76dd026e3e4',
      reference_number: 'REF-1001',
      candidate_id: 'bbe3e0b4-9237-4e8d-9bd7-04fe0e9ce8dd',
    },
    initiated_by: { id: '7fbe6381-916c-4e6e-9d13-09b496d11ba5', role: 'admin' },
    recipient_masked: '+92300*****12',
    provider_reference: null,
    error_code: null,
    sent_at: '2026-09-01T10:05:00Z',
    delivered_at: null,
    failed_at: null,
    created_at: '2026-09-01T10:05:00Z',
    ...overrides,
  };
}

/** A fake StaffAuthClient that just attaches a fixed token and rethrows whatever `makeRequest` throws -- authenticatedDataRequest's own refresh/401 behavior is covered separately in realStaffAuthClient.test.ts (same rationale as realAdminAuditEventsClient.test.ts's identical fake). */
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
  const client = createAdminCommunicationsClient({ apiClient, staffAuthClient, getLocale: () => locale });
  return { client };
}

describe('createAdminCommunicationsClient (real)', () => {
  describe('listCommunications', () => {
    it('fetches the real backend list with auth/locale headers and maps the response', async () => {
      let seenUrl = '';
      let seenInit: RequestInit | undefined;
      stubFetch(async (url, init) => {
        seenUrl = String(url);
        seenInit = init as RequestInit;
        return jsonResponse(
          successEnvelope([communicationPayload()], {
            pagination: { page: 1, per_page: 20, total_count: 1, total_pages: 1 },
            applied_filters: { channel: 'ai_voice_call' },
          })
        );
      });

      const { client } = buildClient('ur');
      const result = await client.listCommunications(
        {
          channel: 'ai_voice_call',
          direction: 'outbound',
          status: 'completed',
          candidateAssignment: 'a1',
          candidate: 'c1',
          occurredFrom: '2026-08-01',
          occurredTo: '2026-08-31',
        },
        'created_at',
        { number: 1, size: 20 }
      );

      expect(seenUrl).toBe(
        'http://example.test/api/v1/admin/communications?filter%5Bchannel%5D=ai_voice_call&filter%5Bdirection%5D=outbound' +
          '&filter%5Bstatus%5D=completed&filter%5Bcandidate_assignment%5D=a1&filter%5Bcandidate%5D=c1' +
          '&filter%5Boccurred_from%5D=2026-08-01&filter%5Boccurred_to%5D=2026-08-31&sort=created_at&page%5Bnumber%5D=1&page%5Bsize%5D=20'
      );
      const headers = seenInit?.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer staff-access-token');
      expect(headers['X-Locale']).toBe('ur');

      expect(result.items).toEqual([
        {
          id: '2a6f9c4e-9a3e-4f0e-9a0a-5a6f9c4e9a3e',
          channelCode: 'ai_voice_call',
          directionCode: 'outbound',
          statusCode: 'completed',
          templateCode: undefined,
          locale: 'en',
          candidateAssignment: {
            id: 'd8805480-7d1b-4ef4-aee6-c76dd026e3e4',
            referenceNumber: 'REF-1001',
            candidateId: 'bbe3e0b4-9237-4e8d-9bd7-04fe0e9ce8dd',
          },
          initiatedBy: { id: '7fbe6381-916c-4e6e-9d13-09b496d11ba5', role: 'admin' },
          recipientMasked: '+92300*****12',
          providerReference: undefined,
          errorCode: undefined,
          sentAt: '2026-09-01T10:05:00Z',
          deliveredAt: undefined,
          failedAt: undefined,
          createdAt: '2026-09-01T10:05:00Z',
        },
      ]);
      expect(result.pagination).toEqual({ page: 1, perPage: 20, totalCount: 1, totalPages: 1 });
      expect(result.appliedFilters).toEqual({ channel: 'ai_voice_call' });
    });

    it('maps an absent candidate_assignment/initiated_by to undefined, not null, for an unidentified inbound call', async () => {
      stubFetch(async () =>
        jsonResponse(successEnvelope([communicationPayload({ candidate_assignment: null, initiated_by: null, direction_code: 'inbound' })]))
      );
      const { client } = buildClient();

      const result = await client.listCommunications({}, undefined, {});

      expect(result.items[0].candidateAssignment).toBeUndefined();
      expect(result.items[0].initiatedBy).toBeUndefined();
    });

    it('fetches with no filters when none are supplied', async () => {
      let seenUrl = '';
      stubFetch(async (url) => {
        seenUrl = String(url);
        return jsonResponse(successEnvelope([]));
      });
      const { client } = buildClient();

      await client.listCommunications({}, undefined, {});

      expect(seenUrl).toBe('http://example.test/api/v1/admin/communications');
    });

    it('maps a 400 unsupported filter to BAD_REQUEST with its field', async () => {
      stubFetch(async () =>
        jsonResponse(errorEnvelope([{ code: 'unsupported_filter', message: 'Unsupported filter.', field: 'filter.bogus' }]), { status: 400 })
      );
      const { client } = buildClient();

      await expect(client.listCommunications({}, undefined, {})).rejects.toMatchObject({ code: 'BAD_REQUEST', field: 'filter.bogus' });
    });

    it('maps an ordinary 403 to FORBIDDEN', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'forbidden', message: 'Not permitted.' }]), { status: 403 }));
      const { client } = buildClient();

      await expect(client.listCommunications({}, undefined, {})).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('maps a 403 with inactive_account to INACTIVE_ACCOUNT, distinct from a generic FORBIDDEN', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'inactive_account', message: 'Inactive.' }]), { status: 403 }));
      const { client } = buildClient();

      await expect(client.listCommunications({}, undefined, {})).rejects.toMatchObject({ code: 'INACTIVE_ACCOUNT' });
    });

    it('maps a 5xx to SERVER_ERROR', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'internal_server_error', message: 'Boom.' }]), { status: 500 }));
      const { client } = buildClient();

      await expect(client.listCommunications({}, undefined, {})).rejects.toMatchObject({ code: 'SERVER_ERROR' });
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
      const client = createAdminCommunicationsClient({ apiClient, staffAuthClient, getLocale: () => 'en' });

      await expect(client.listCommunications({}, undefined, {})).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
    });
  });
});

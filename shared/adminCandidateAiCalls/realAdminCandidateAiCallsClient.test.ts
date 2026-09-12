import { createApiClient } from '../api-client';
import type { StaffAuthClient } from '../auth/staffTypes';
import { createAdminCandidateAiCallsClient } from './realAdminCandidateAiCallsClient';

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

function callPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: '2a6f9c4e-9a3e-4f0e-9a0a-5a6f9c4e9a3e',
    direction: 'outbound',
    call_reason: 'missing_documents',
    language_code: 'en',
    status: 'queued',
    triggered_by: { id: '2be3e0b4-9237-4e8d-9bd7-04fe0e9ce8aa', role: 'admin' },
    outcome: null,
    outcome_reason: null,
    verification_status: 'not_applicable',
    summary: null,
    started_at: null,
    answered_at: null,
    completed_at: null,
    created_at: '2026-09-10T10:00:00Z',
    ...overrides,
  };
}

/** A fake StaffAuthClient that just attaches a fixed token and rethrows whatever `makeRequest` throws -- authenticatedDataRequest's own refresh/401 behavior is covered separately in realStaffAuthClient.test.ts (same rationale as realAdminWorkflowClient.test.ts's identical fake). */
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
  const client = createAdminCandidateAiCallsClient({ apiClient, staffAuthClient, getLocale: () => locale });
  return { client };
}

describe('createAdminCandidateAiCallsClient (real)', () => {
  describe('listCandidateAiCalls', () => {
    it('fetches the real backend list with auth/locale headers and maps the response', async () => {
      let seenUrl = '';
      let seenInit: RequestInit | undefined;
      stubFetch(async (url, init) => {
        seenUrl = String(url);
        seenInit = init as RequestInit;
        return jsonResponse(successEnvelope([callPayload()]));
      });

      const { client } = buildClient('ur');
      const result = await client.listCandidateAiCalls('candidate-1');

      expect(seenUrl).toBe('http://example.test/api/v1/admin/candidates/candidate-1/ai_calls');
      const headers = seenInit?.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer staff-access-token');
      expect(headers['X-Locale']).toBe('ur');

      expect(result).toEqual([
        {
          id: '2a6f9c4e-9a3e-4f0e-9a0a-5a6f9c4e9a3e',
          direction: 'outbound',
          callReason: 'missing_documents',
          languageCode: 'en',
          status: 'queued',
          triggeredBy: { id: '2be3e0b4-9237-4e8d-9bd7-04fe0e9ce8aa', role: 'admin' },
          outcome: undefined,
          outcomeReason: undefined,
          verificationStatus: 'not_applicable',
          summary: undefined,
          startedAt: undefined,
          answeredAt: undefined,
          completedAt: undefined,
          createdAt: '2026-09-10T10:00:00Z',
        },
      ]);
    });

    it('maps an empty history to an empty array', async () => {
      stubFetch(async () => jsonResponse(successEnvelope([])));
      const { client } = buildClient();

      expect(await client.listCandidateAiCalls('candidate-1')).toEqual([]);
    });

    it('URL-encodes the candidate id', async () => {
      let seenUrl = '';
      stubFetch(async (url) => {
        seenUrl = String(url);
        return jsonResponse(successEnvelope([]));
      });
      const { client } = buildClient();

      await client.listCandidateAiCalls('candidate one/two');

      expect(seenUrl).toBe('http://example.test/api/v1/admin/candidates/candidate%20one%2Ftwo/ai_calls');
    });
  });

  describe('triggerCandidateAiCall', () => {
    it('sends the documented request body shape and the Idempotency-Key header', async () => {
      let capturedBody: string | undefined;
      let capturedHeaders: Record<string, string> | undefined;
      let capturedUrl: string | undefined;
      stubFetch(async (url, init) => {
        capturedUrl = String(url);
        capturedBody = init?.body as string;
        capturedHeaders = init?.headers as Record<string, string>;
        return jsonResponse(successEnvelope(callPayload({ status: 'requested' })), { status: 201 });
      });
      const { client } = buildClient();

      const result = await client.triggerCandidateAiCall('candidate-1', 'flight_information', 'idem-key-1');

      expect(capturedUrl).toBe('http://example.test/api/v1/admin/candidates/candidate-1/ai_calls');
      expect(capturedHeaders?.['Idempotency-Key']).toBe('idem-key-1');
      expect(JSON.parse(capturedBody!)).toEqual({ candidate_ai_call: { call_reason: 'flight_information' } });
      expect(result.status).toBe('requested');
      expect(result.callReason).toBe('missing_documents');
    });

    async function rejectionForServerCode(code: string, status: number) {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code, message: 'server message', field: 'candidate_ai_call.call_reason' }]), { status }));
      const { client } = buildClient();
      try {
        await client.triggerCandidateAiCall('candidate-1', 'missing_documents', 'idem-key-1');
        throw new Error('expected rejection');
      } catch (error) {
        return error;
      }
    }

    it.each([
      ['validation_failed', 422, 'VALIDATION_FAILED'],
      ['idempotency_conflict', 409, 'IDEMPOTENCY_CONFLICT'],
      ['missing_idempotency_key', 400, 'MISSING_IDEMPOTENCY_KEY'],
      ['inactive_account', 403, 'INACTIVE_ACCOUNT'],
    ])('maps server code %s (%i) to %s', async (code, status, expectedCode) => {
      const error = await rejectionForServerCode(code as string, status as number);
      expect(error).toMatchObject({ code: expectedCode, message: 'server message' });
    });

    it('maps an ordinary 403 (no serverCode) to FORBIDDEN', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'forbidden', message: 'Not permitted.' }]), { status: 403 }));
      const { client } = buildClient();

      await expect(client.triggerCandidateAiCall('candidate-1', 'missing_documents', 'idem-key-1')).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });

    it('maps a 404 to NOT_FOUND', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'not_found', message: 'Candidate not found.' }]), { status: 404 }));
      const { client } = buildClient();

      await expect(client.triggerCandidateAiCall('candidate-1', 'missing_documents', 'idem-key-1')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('maps a 429 to RATE_LIMITED with retryAfterSeconds', async () => {
      stubFetch(async () =>
        jsonResponse(errorEnvelope([{ code: 'rate_limited', message: 'Too many calls.' }]), {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
        })
      );
      const { client } = buildClient();

      await expect(client.triggerCandidateAiCall('candidate-1', 'missing_documents', 'idem-key-1')).rejects.toMatchObject({
        code: 'RATE_LIMITED',
      });
    });

    it('maps a 502 to PROVIDER_ERROR', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'bad_gateway', message: 'Provider failed.' }]), { status: 502 }));
      const { client } = buildClient();

      await expect(client.triggerCandidateAiCall('candidate-1', 'missing_documents', 'idem-key-1')).rejects.toMatchObject({
        code: 'PROVIDER_ERROR',
      });
    });

    it('maps a 503 to CALLING_UNAVAILABLE', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'service_unavailable', message: 'Calling disabled.' }]), { status: 503 }));
      const { client } = buildClient();

      await expect(client.triggerCandidateAiCall('candidate-1', 'missing_documents', 'idem-key-1')).rejects.toMatchObject({
        code: 'CALLING_UNAVAILABLE',
      });
    });

    it('maps a 5xx to SERVER_ERROR', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'internal_server_error', message: 'Boom.' }]), { status: 500 }));
      const { client } = buildClient();

      await expect(client.triggerCandidateAiCall('candidate-1', 'missing_documents', 'idem-key-1')).rejects.toMatchObject({
        code: 'SERVER_ERROR',
      });
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
      const client = createAdminCandidateAiCallsClient({ apiClient, staffAuthClient, getLocale: () => 'en' });

      await expect(client.triggerCandidateAiCall('candidate-1', 'missing_documents', 'idem-key-1')).rejects.toMatchObject({
        code: 'SESSION_EXPIRED',
      });
    });
  });
});

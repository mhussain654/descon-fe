// Framework-agnostic: runs under both web's Vitest and mobile's Jest.
import { createApiClient } from '../api-client';
import { createCandidateConsentClient } from './realCandidateConsentClient';

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
  return { data, meta: { request_id: 'req-1', timestamp: '2026-09-06T09:00:00Z' }, errors: [] };
}

function errorEnvelope(errors: Array<{ code: string; message: string }>) {
  return { errors, request_id: 'req-1' };
}

function buildClient(locale: 'en' | 'ur' = 'en') {
  const apiClient = createApiClient({ baseUrl: 'http://example.test/api/v1' });
  return createCandidateConsentClient({ apiClient, getLocale: () => locale });
}

describe('createCandidateConsentClient (real)', () => {
  it('fetches consent status with the bearer token and locale', async () => {
    let seenUrl = '';
    let seenMethod = '';
    let seenHeaders: Record<string, string> = {};
    stubFetch(async (url, init) => {
      seenUrl = String(url);
      seenMethod = (init as RequestInit)?.method ?? 'GET';
      seenHeaders = (init as RequestInit)?.headers as Record<string, string>;
      return jsonResponse(
        successEnvelope({ current_policy_version: '2026-09-06', accepted: false, accepted_at: null })
      );
    });

    const client = buildClient('ur');
    const status = await client.fetchStatus('candidate-access-token');

    expect(seenUrl).toBe('http://example.test/api/v1/candidate/consent');
    expect(seenMethod).toBe('GET');
    expect(seenHeaders.Authorization).toBe('Bearer candidate-access-token');
    expect(seenHeaders['X-Locale']).toBe('ur');
    expect(status).toEqual({ currentPolicyVersion: '2026-09-06', accepted: false, acceptedAt: null });
  });

  it('accepts the current policy version via POST', async () => {
    let seenMethod = '';
    stubFetch(async (_url, init) => {
      seenMethod = (init as RequestInit)?.method ?? 'GET';
      return jsonResponse(
        successEnvelope({ current_policy_version: '2026-09-06', accepted: true, accepted_at: '2026-09-06T12:00:00Z' }),
        { status: 201 }
      );
    });

    const client = buildClient();
    const status = await client.accept('candidate-access-token');

    expect(seenMethod).toBe('POST');
    expect(status).toEqual({
      currentPolicyVersion: '2026-09-06',
      accepted: true,
      acceptedAt: '2026-09-06T12:00:00Z',
    });
  });

  it('maps inactive_account to INACTIVE_ACCOUNT', async () => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: 'inactive_account', message: 'This account is inactive.' }]), {
        status: 403,
      })
    );

    const client = buildClient();

    await expect(client.fetchStatus('token')).rejects.toEqual({ code: 'INACTIVE_ACCOUNT' });
  });

  it('maps a missing/expired session to SESSION_EXPIRED', async () => {
    stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'unauthorized', message: 'Invalid credentials.' }]), { status: 401 }));

    const client = buildClient();

    await expect(client.accept('token')).rejects.toEqual({ code: 'SESSION_EXPIRED' });
  });
});

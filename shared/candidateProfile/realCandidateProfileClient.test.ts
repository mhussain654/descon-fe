// Framework-agnostic: runs under both web's Vitest and mobile's Jest.
import { createApiClient } from '../api-client';
import { createCandidateProfileClient } from './realCandidateProfileClient';

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
  return { data, meta: { request_id: 'req-1', timestamp: '2026-08-26T09:00:00Z' }, errors: [] };
}

function errorEnvelope(errors: Array<{ code: string; message: string; field?: string }>) {
  return { errors, request_id: 'req-1' };
}

function profilePayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 'candidate-public-id-1',
    full_name: 'Ahmed Ali',
    masked_cnic: '42101-*******-1',
    reference_number: 'DES-001001',
    preferred_locale: 'en',
    candidate_status: 'registered',
    current_workflow_stage: { code: 'registered', name: 'Registered' },
    active: true,
    ...overrides,
  };
}

function buildClient(locale: 'en' | 'ur' = 'en') {
  const apiClient = createApiClient({ baseUrl: 'http://example.test/api/v1' });
  return createCandidateProfileClient({ apiClient, getLocale: () => locale });
}

describe('createCandidateProfileClient (real)', () => {
  it('fetches the profile with the bearer token and locale, mapping snake_case fields to the client shape', async () => {
    let seenUrl = '';
    let seenHeaders: Record<string, string> = {};
    stubFetch(async (url, init) => {
      seenUrl = String(url);
      seenHeaders = (init as RequestInit)?.headers as Record<string, string>;
      return jsonResponse(successEnvelope(profilePayload()));
    });

    const client = buildClient('ur');
    const profile = await client.getProfile('candidate-access-token');

    expect(seenUrl).toBe('http://example.test/api/v1/candidate/profile');
    expect(seenHeaders.Authorization).toBe('Bearer candidate-access-token');
    expect(seenHeaders['X-Locale']).toBe('ur');
    expect(profile).toEqual({
      id: 'candidate-public-id-1',
      fullName: 'Ahmed Ali',
      maskedCnic: '42101-*******-1',
      referenceNumber: 'DES-001001',
      preferredLocale: 'en',
      candidateStatus: 'registered',
      currentWorkflowStage: { code: 'registered', name: 'Registered' },
      active: true,
    });
  });

  it('never sends a candidate id in the request path -- identity comes only from the bearer token', async () => {
    let seenUrl = '';
    stubFetch(async (url) => {
      seenUrl = String(url);
      return jsonResponse(successEnvelope(profilePayload()));
    });

    const client = buildClient();
    await client.getProfile('candidate-access-token');

    expect(seenUrl).not.toMatch(/candidate-access-token|candidate-public-id-1/);
  });

  it('maps a null current_workflow_stage through unchanged (candidate has no assignment yet)', async () => {
    stubFetch(async () => jsonResponse(successEnvelope(profilePayload({ current_workflow_stage: null }))));

    const client = buildClient();
    const profile = await client.getProfile('token');

    expect(profile.currentWorkflowStage).toBeNull();
  });

  it('maps a 401 to SESSION_EXPIRED', async () => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: 'unauthorized', message: 'Session expired.' }]), { status: 401 })
    );

    const client = buildClient();
    await expect(client.getProfile('token')).rejects.toEqual({ code: 'SESSION_EXPIRED' });
  });

  it('maps a 403 inactive_account to INACTIVE_ACCOUNT', async () => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: 'inactive_account', message: 'This account is inactive.' }]), {
        status: 403,
      })
    );

    const client = buildClient();
    await expect(client.getProfile('token')).rejects.toEqual({ code: 'INACTIVE_ACCOUNT' });
  });

  it('maps an unrecognized 403 to FORBIDDEN', async () => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: 'something_else', message: 'Nope.' }]), { status: 403 })
    );

    const client = buildClient();
    await expect(client.getProfile('token')).rejects.toEqual({ code: 'FORBIDDEN' });
  });

  it('maps a 429 to RATE_LIMITED with the Retry-After seconds', async () => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: 'rate_limited', message: 'Too many requests.' }]), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '15' },
      })
    );

    const client = buildClient();
    await expect(client.getProfile('token')).rejects.toEqual({ code: 'RATE_LIMITED', retryAfterSeconds: 15 });
  });

  it('maps a 5xx to SERVER_ERROR', async () => {
    stubFetch(async () => new Response('Internal Server Error', { status: 500 }));

    const client = buildClient();
    await expect(client.getProfile('token')).rejects.toEqual({ code: 'SERVER_ERROR' });
  });

  it('maps a network failure to NETWORK_ERROR', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });

    const client = buildClient();
    await expect(client.getProfile('token')).rejects.toEqual({ code: 'NETWORK_ERROR' });
  });

  it('maps offline to OFFLINE', async () => {
    const apiClient = createApiClient({ baseUrl: 'http://example.test/api/v1', isOnline: () => false });
    const client = createCandidateProfileClient({ apiClient, getLocale: () => 'en' });
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });

    await expect(client.getProfile('token')).rejects.toEqual({ code: 'OFFLINE' });
  });
});

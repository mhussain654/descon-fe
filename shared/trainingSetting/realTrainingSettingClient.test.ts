import { createApiClient } from '../api-client';
import { createTrainingSettingClient } from './realTrainingSettingClient';

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
  return { data, meta: { request_id: 'req-1', timestamp: '2026-09-15T10:00:00Z' }, errors: [] };
}

function errorEnvelope(errors: Array<{ code: string; message: string }>) {
  return { errors, request_id: 'req-1', timestamp: '2026-09-15T10:00:00Z' };
}

function buildClient(locale: 'en' | 'ur' = 'en') {
  const apiClient = createApiClient({ baseUrl: 'http://example.test/api/v1' });
  return createTrainingSettingClient({ apiClient, getLocale: () => locale });
}

describe('createTrainingSettingClient (real) -- getTrainingSetting', () => {
  it('fetches with the bearer token and locale headers', async () => {
    let seenUrl = '';
    let seenHeaders: Record<string, string> = {};
    stubFetch(async (url, init) => {
      seenUrl = String(url);
      seenHeaders = (init as RequestInit)?.headers as Record<string, string>;
      return jsonResponse(successEnvelope({ url: 'https://www.youtube.com/@DesconManpower' }));
    });

    const client = buildClient('ur');
    await client.getTrainingSetting('candidate-access-token');

    expect(seenUrl).toBe('http://example.test/api/v1/candidate/training_setting');
    expect(seenHeaders.Authorization).toBe('Bearer candidate-access-token');
    expect(seenHeaders['X-Locale']).toBe('ur');
  });

  it('maps the response', async () => {
    stubFetch(async () => jsonResponse(successEnvelope({ url: 'https://www.youtube.com/@DesconManpower' })));

    const client = buildClient();
    const setting = await client.getTrainingSetting('token');

    expect(setting).toEqual({ url: 'https://www.youtube.com/@DesconManpower' });
  });

  it('maps a 401 to SESSION_EXPIRED', async () => {
    stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'unauthorized', message: 'Session expired.' }]), { status: 401 }));

    const client = buildClient();
    await expect(client.getTrainingSetting('token')).rejects.toEqual({ code: 'SESSION_EXPIRED' });
  });

  it('maps a 403 inactive_account to INACTIVE_ACCOUNT', async () => {
    stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'inactive_account', message: 'Inactive.' }]), { status: 403 }));

    const client = buildClient();
    await expect(client.getTrainingSetting('token')).rejects.toEqual({ code: 'INACTIVE_ACCOUNT', message: 'Inactive.' });
  });

  it('maps a 429 to RATE_LIMITED with the Retry-After seconds', async () => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: 'rate_limited', message: 'Too many requests.' }]), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '20' },
      })
    );

    const client = buildClient();
    await expect(client.getTrainingSetting('token')).rejects.toEqual({ code: 'RATE_LIMITED', retryAfterSeconds: 20 });
  });

  it('maps a 5xx to SERVER_ERROR', async () => {
    stubFetch(async () => new Response('Internal Server Error', { status: 500 }));

    const client = buildClient();
    await expect(client.getTrainingSetting('token')).rejects.toEqual({ code: 'SERVER_ERROR' });
  });

  it('maps a network failure to NETWORK_ERROR', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });

    const client = buildClient();
    await expect(client.getTrainingSetting('token')).rejects.toEqual({ code: 'NETWORK_ERROR' });
  });
});

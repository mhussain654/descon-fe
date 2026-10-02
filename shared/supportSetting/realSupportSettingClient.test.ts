import { createApiClient } from '../api-client';
import { createSupportSettingClient } from './realSupportSettingClient';

const originalFetch = globalThis.fetch;
function stubFetch(impl: typeof fetch) {
  globalThis.fetch = impl as typeof fetch;
}
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' }, ...init });
}

function successEnvelope(data: unknown) {
  return { data, meta: { request_id: 'req-1', timestamp: '2026-10-02T10:00:00Z' }, errors: [] };
}

function buildClient(locale: 'en' | 'ur' = 'en') {
  const apiClient = createApiClient({ baseUrl: 'http://example.test/api/v1' });
  return createSupportSettingClient({ apiClient, getLocale: () => locale });
}

describe('createSupportSettingClient (real) -- getSupportSetting', () => {
  it('fetches with the bearer token and locale headers, mapping the number', async () => {
    let seenUrl = '';
    let seenHeaders: Record<string, string> = {};
    stubFetch(async (url, init) => {
      seenUrl = String(url);
      seenHeaders = (init as RequestInit)?.headers as Record<string, string>;
      return jsonResponse(successEnvelope({ phone_number: '+923001234567' }));
    });

    const setting = await buildClient('ur').getSupportSetting('token-1');

    expect(seenUrl).toBe('http://example.test/api/v1/candidate/support_setting');
    expect(seenHeaders.Authorization).toBe('Bearer token-1');
    expect(seenHeaders['X-Locale']).toBe('ur');
    expect(setting).toEqual({ phoneNumber: '+923001234567' });
  });

  it('maps a not-yet-configured number to null', async () => {
    stubFetch(async () => jsonResponse(successEnvelope({ phone_number: null })));

    await expect(buildClient().getSupportSetting('token-1')).resolves.toEqual({ phoneNumber: null });
  });

  it('maps a 401 to SESSION_EXPIRED', async () => {
    stubFetch(async () => jsonResponse({ errors: [{ code: 'unauthorized', message: 'x' }] }, { status: 401 }));

    await expect(buildClient().getSupportSetting('token-1')).rejects.toEqual({ code: 'SESSION_EXPIRED' });
  });
});

import { createApiClient } from '../api-client';
import type { StaffAuthClient } from '../auth/staffTypes';
import { createAdminTrainingSettingClient } from './realAdminTrainingSettingClient';

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
  return { data, meta: { request_id: 'req-1', timestamp: '2026-09-12T09:00:00Z' }, errors: [] };
}

function errorEnvelope(errors: Array<{ code: string; message: string; field?: string }>) {
  return { errors, request_id: 'req-1' };
}

function settingPayload(overrides: Record<string, unknown> = {}) {
  return {
    url: 'https://www.youtube.com/@DesconManpower',
    updated_by: null,
    updated_at: '2026-09-12T09:00:00Z',
    ...overrides,
  };
}

/** A fake StaffAuthClient that just attaches a fixed token and rethrows whatever `makeRequest` throws -- see realAdminAiCallOperationalSettingsClient.test.ts's identical fake. */
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
  const client = createAdminTrainingSettingClient({ apiClient, staffAuthClient, getLocale: () => locale });
  return { client };
}

describe('createAdminTrainingSettingClient (real)', () => {
  describe('getTrainingSetting', () => {
    it('fetches the real backend row with auth/locale headers and maps it through', async () => {
      let seenUrl = '';
      let seenInit: RequestInit | undefined;
      stubFetch(async (url, init) => {
        seenUrl = String(url);
        seenInit = init as RequestInit;
        return jsonResponse(successEnvelope(settingPayload()));
      });

      const { client } = buildClient('ur');
      const result = await client.getTrainingSetting();

      expect(seenUrl).toBe('http://example.test/api/v1/admin/training_setting');
      const headers = seenInit?.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer staff-access-token');
      expect(headers['X-Locale']).toBe('ur');
      expect(result).toEqual({ url: 'https://www.youtube.com/@DesconManpower', updatedBy: undefined, updatedAt: '2026-09-12T09:00:00Z' });
    });

    it('maps an actor through', async () => {
      stubFetch(async () => jsonResponse(successEnvelope(settingPayload({ updated_by: { id: 'staff-1', role: 'admin' } }))));
      const { client } = buildClient();

      const result = await client.getTrainingSetting();

      expect(result.updatedBy).toEqual({ id: 'staff-1', role: 'admin' });
    });
  });

  describe('updateTrainingSetting', () => {
    it('sends the documented request body shape with no Idempotency-Key header', async () => {
      let capturedBody: string | undefined;
      let capturedHeaders: Record<string, string> | undefined;
      let capturedUrl: string | undefined;
      let capturedMethod: string | undefined;
      stubFetch(async (url, init) => {
        capturedUrl = String(url);
        capturedMethod = init?.method;
        capturedBody = init?.body as string;
        capturedHeaders = init?.headers as Record<string, string>;
        return jsonResponse(successEnvelope(settingPayload({ url: 'https://example.test/updated' })));
      });
      const { client } = buildClient();

      const result = await client.updateTrainingSetting({ url: 'https://example.test/updated' });

      expect(capturedUrl).toBe('http://example.test/api/v1/admin/training_setting');
      expect(capturedMethod).toBe('PATCH');
      expect(capturedHeaders?.['Idempotency-Key']).toBeUndefined();
      expect(JSON.parse(capturedBody!)).toEqual({ training_setting: { url: 'https://example.test/updated' } });
      expect(result.url).toBe('https://example.test/updated');
    });

    async function rejectionForServerCode(code: string, status: number) {
      stubFetch(async () =>
        jsonResponse(errorEnvelope([{ code, message: 'server message', field: 'training_setting.url' }]), { status })
      );
      const { client } = buildClient();
      try {
        await client.updateTrainingSetting({ url: 'not a url' });
        throw new Error('expected rejection');
      } catch (error) {
        return error;
      }
    }

    it.each([
      ['validation_failed', 422, 'VALIDATION_FAILED'],
      ['inactive_account', 403, 'INACTIVE_ACCOUNT'],
    ])('maps server code %s (%i) to %s', async (code, status, expectedCode) => {
      const error = await rejectionForServerCode(code as string, status as number);
      expect(error).toMatchObject({ code: expectedCode, message: 'server message' });
    });

    it('maps an ordinary 403 (no serverCode) to FORBIDDEN', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'forbidden', message: 'Not permitted.' }]), { status: 403 }));
      const { client } = buildClient();

      await expect(client.updateTrainingSetting({ url: 'https://example.test' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('maps a 5xx to SERVER_ERROR', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'internal_server_error', message: 'Boom.' }]), { status: 500 }));
      const { client } = buildClient();

      await expect(client.updateTrainingSetting({ url: 'https://example.test' })).rejects.toMatchObject({ code: 'SERVER_ERROR' });
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
      const client = createAdminTrainingSettingClient({ apiClient, staffAuthClient, getLocale: () => 'en' });

      await expect(client.updateTrainingSetting({ url: 'https://example.test' })).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
    });
  });
});

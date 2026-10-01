import { createApiClient } from '../api-client';
import type { StaffAuthClient } from '../auth/staffTypes';
import { createAdminAiCallOperationalSettingsClient } from './realAdminAiCallOperationalSettingsClient';

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

function settingPayload(overrides: Record<string, unknown> = {}) {
  return {
    outbound_trigger_cooldown_minutes: null,
    daily_outbound_call_limit: null,
    admin_trigger_rate_limit_per_hour: null,
    calling_hours_start: null,
    calling_hours_end: null,
    max_call_duration_minutes: null,
    updated_by: null,
    updated_at: '2026-09-11T09:00:00Z',
    ...overrides,
  };
}

/** A fake StaffAuthClient that just attaches a fixed token and rethrows whatever `makeRequest` throws -- authenticatedDataRequest's own refresh/401 behavior is covered separately in realStaffAuthClient.test.ts (same rationale as realAdminWorkflowStageCallScriptsClient.test.ts's identical fake). */
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
  const client = createAdminAiCallOperationalSettingsClient({ apiClient, staffAuthClient, getLocale: () => locale });
  return { client };
}

describe('createAdminAiCallOperationalSettingsClient (real)', () => {
  describe('getAiCallOperationalSettings', () => {
    it('fetches the real backend row with auth/locale headers and maps null fields through', async () => {
      let seenUrl = '';
      let seenInit: RequestInit | undefined;
      stubFetch(async (url, init) => {
        seenUrl = String(url);
        seenInit = init as RequestInit;
        return jsonResponse(successEnvelope(settingPayload()));
      });

      const { client } = buildClient('ur');
      const result = await client.getAiCallOperationalSettings();

      expect(seenUrl).toBe('http://example.test/api/v1/admin/ai_call_operational_settings');
      const headers = seenInit?.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer staff-access-token');
      expect(headers['X-Locale']).toBe('ur');

      expect(result).toEqual({
        outboundTriggerCooldownMinutes: null,
        dailyOutboundCallLimit: null,
        adminTriggerRateLimitPerHour: null,
        callingHoursStart: null,
        callingHoursEnd: null,
        maxCallDurationMinutes: null,
        updatedBy: undefined,
        updatedAt: '2026-09-11T09:00:00Z',
      });
    });

    it('maps set numeric overrides and an actor through', async () => {
      stubFetch(async () =>
        jsonResponse(
          successEnvelope(
            settingPayload({
              outbound_trigger_cooldown_minutes: 30,
              daily_outbound_call_limit: 75,
              calling_hours_start: 8,
              calling_hours_end: 20,
              updated_by: { id: 'staff-1', role: 'admin' },
            })
          )
        )
      );
      const { client } = buildClient();

      const result = await client.getAiCallOperationalSettings();

      expect(result.outboundTriggerCooldownMinutes).toBe(30);
      expect(result.dailyOutboundCallLimit).toBe(75);
      expect(result.callingHoursStart).toBe(8);
      expect(result.callingHoursEnd).toBe(20);
      expect(result.updatedBy).toEqual({ id: 'staff-1', role: 'admin' });
    });
  });

  describe('updateAiCallOperationalSettings', () => {
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
        return jsonResponse(successEnvelope(settingPayload({ daily_outbound_call_limit: 50 })));
      });
      const { client } = buildClient();

      const result = await client.updateAiCallOperationalSettings({
        outboundTriggerCooldownMinutes: null,
        dailyOutboundCallLimit: 50,
        adminTriggerRateLimitPerHour: null,
        callingHoursStart: null,
        callingHoursEnd: null,
        maxCallDurationMinutes: null,
      });

      expect(capturedUrl).toBe('http://example.test/api/v1/admin/ai_call_operational_settings');
      expect(capturedMethod).toBe('PATCH');
      expect(capturedHeaders?.['Idempotency-Key']).toBeUndefined();
      expect(JSON.parse(capturedBody!)).toEqual({
        ai_call_operational_setting: {
          outbound_trigger_cooldown_minutes: null,
          daily_outbound_call_limit: 50,
          admin_trigger_rate_limit_per_hour: null,
          calling_hours_start: null,
          calling_hours_end: null,
          max_call_duration_minutes: null,
        },
      });
      expect(result.dailyOutboundCallLimit).toBe(50);
    });

    async function rejectionForServerCode(code: string, status: number) {
      stubFetch(async () =>
        jsonResponse(errorEnvelope([{ code, message: 'server message', field: 'ai_call_operational_setting.calling_hours_start' }]), { status })
      );
      const { client } = buildClient();
      try {
        await client.updateAiCallOperationalSettings({
          outboundTriggerCooldownMinutes: null,
          dailyOutboundCallLimit: null,
          adminTriggerRateLimitPerHour: null,
          callingHoursStart: 24,
          callingHoursEnd: null,
          maxCallDurationMinutes: null,
        });
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

      await expect(
        client.updateAiCallOperationalSettings({
          outboundTriggerCooldownMinutes: null,
          dailyOutboundCallLimit: null,
          adminTriggerRateLimitPerHour: null,
          callingHoursStart: null,
          callingHoursEnd: null,
          maxCallDurationMinutes: null,
        })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('maps a 5xx to SERVER_ERROR', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'internal_server_error', message: 'Boom.' }]), { status: 500 }));
      const { client } = buildClient();

      await expect(
        client.updateAiCallOperationalSettings({
          outboundTriggerCooldownMinutes: null,
          dailyOutboundCallLimit: null,
          adminTriggerRateLimitPerHour: null,
          callingHoursStart: null,
          callingHoursEnd: null,
          maxCallDurationMinutes: null,
        })
      ).rejects.toMatchObject({ code: 'SERVER_ERROR' });
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
      const client = createAdminAiCallOperationalSettingsClient({ apiClient, staffAuthClient, getLocale: () => 'en' });

      await expect(
        client.updateAiCallOperationalSettings({
          outboundTriggerCooldownMinutes: null,
          dailyOutboundCallLimit: null,
          adminTriggerRateLimitPerHour: null,
          callingHoursStart: null,
          callingHoursEnd: null,
          maxCallDurationMinutes: null,
        })
      ).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
    });
  });
});

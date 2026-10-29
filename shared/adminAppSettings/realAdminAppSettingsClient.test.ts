import { createApiClient } from '../api-client';
import type { StaffAuthClient } from '../auth/staffTypes';
import { createAdminAppSettingsClient } from './realAdminAppSettingsClient';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' }, ...init });
}

function successEnvelope(data: unknown) {
  return { data, meta: { request_id: 'req-1', timestamp: '2026-10-29T09:00:00Z' }, errors: [] };
}

function settingPayload() {
  return {
    card_payment_enabled: true,
    voucher_payment_enabled: false,
    progress_sms_enabled: true,
    automatic_calls_enabled: true,
    bulk_calls_enabled: false,
    document_ocr_enabled: true,
    sms_messages: [{ code: 'fee_pending', enabled: false, template_ready: true }],
    server_ready: {
      card_payment: true,
      voucher_payment: true,
      progress_sms: false,
      automatic_calls: true,
      bulk_calls: true,
      document_ocr: false,
    },
    updated_by: { id: 'admin-1', role: 'admin' },
    updated_at: '2026-10-29T09:00:00Z',
  };
}

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

function buildClient() {
  const apiClient = createApiClient({ baseUrl: 'http://example.test/api/v1' });
  return createAdminAppSettingsClient({ apiClient, staffAuthClient: fakeStaffAuthClient(), getLocale: () => 'en' });
}

describe('createAdminAppSettingsClient (real)', () => {
  it('maps the switches, server readiness and SMS messages', async () => {
    globalThis.fetch = (async () => jsonResponse(successEnvelope(settingPayload()))) as typeof fetch;

    const settings = await buildClient().getAppSettings();

    expect(settings.enabled).toEqual({
      cardPayment: true,
      voucherPayment: false,
      progressSms: true,
      automaticCalls: true,
      bulkCalls: false,
      documentOcr: true,
    });
    expect(settings.serverReady.progressSms).toBe(false);
    expect(settings.smsMessages).toEqual([{ code: 'fee_pending', enabled: false, templateReady: true }]);
    expect(settings.updatedBy).toEqual({ id: 'admin-1', role: 'admin' });
  });

  it('sends only the switches given, in the backend field names', async () => {
    let sentBody: unknown;
    globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      sentBody = JSON.parse(String(init?.body));
      return jsonResponse(successEnvelope(settingPayload()));
    }) as typeof fetch;

    await buildClient().updateAppSettings({ enabled: { voucherPayment: false }, disabledSmsMessages: [] });

    expect(sentBody).toEqual({ app_feature_setting: { voucher_payment_enabled: false, disabled_sms_messages: [] } });
  });

  it('turns a 403 into FORBIDDEN and a 422 into VALIDATION_FAILED', async () => {
    globalThis.fetch = (async () =>
      jsonResponse({ errors: [{ code: 'forbidden', message: 'No access' }] }, { status: 403 })) as typeof fetch;
    await expect(buildClient().getAppSettings()).rejects.toMatchObject({ code: 'FORBIDDEN' });

    globalThis.fetch = (async () =>
      jsonResponse({ errors: [{ code: 'validation_failed', message: 'Unknown message' }] }, { status: 422 })) as typeof fetch;
    await expect(buildClient().updateAppSettings({ enabled: {} })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});

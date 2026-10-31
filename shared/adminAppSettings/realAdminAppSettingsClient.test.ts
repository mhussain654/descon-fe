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

function smsTemplatePayload() {
  return {
    message_code: 'otp',
    template_id_en: '10790',
    template_id_ur: null,
    enabled: true,
    can_disable: false,
    variables: ['code', 'minutes'],
    updated_by: { id: 'dev-1', role: 'developer' },
    updated_at: '2026-10-30T09:00:00Z',
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
  it('maps the switches and server readiness', async () => {
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
    expect(settings.updatedBy).toEqual({ id: 'admin-1', role: 'admin' });
  });

  it('sends only the switches given, in the backend field names', async () => {
    let sentBody: unknown;
    globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      sentBody = JSON.parse(String(init?.body));
      return jsonResponse(successEnvelope(settingPayload()));
    }) as typeof fetch;

    await buildClient().updateAppSettings({ enabled: { voucherPayment: false } });

    expect(sentBody).toEqual({ app_feature_setting: { voucher_payment_enabled: false } });
  });

  it('turns a 403 into FORBIDDEN and a 422 into VALIDATION_FAILED', async () => {
    globalThis.fetch = (async () =>
      jsonResponse({ errors: [{ code: 'forbidden', message: 'No access' }] }, { status: 403 })) as typeof fetch;
    await expect(buildClient().getAppSettings()).rejects.toMatchObject({ code: 'FORBIDDEN' });

    globalThis.fetch = (async () =>
      jsonResponse({ errors: [{ code: 'validation_failed', message: 'Unknown message' }] }, { status: 422 })) as typeof fetch;
    await expect(buildClient().updateAppSettings({ enabled: {} })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('lists the SMS messages', async () => {
    let requestedUrl = '';
    globalThis.fetch = (async (url: RequestInfo | URL) => {
      requestedUrl = String(url);
      return jsonResponse(successEnvelope([smsTemplatePayload()]));
    }) as typeof fetch;

    const templates = await buildClient().listSmsTemplates();

    expect(requestedUrl).toBe('http://example.test/api/v1/admin/sms_templates');
    expect(templates).toEqual([
      {
        messageCode: 'otp',
        templateIdEn: '10790',
        templateIdUr: null,
        enabled: true,
        canDisable: false,
        variables: ['code', 'minutes'],
        updatedBy: { id: 'dev-1', role: 'developer' },
        updatedAt: '2026-10-30T09:00:00Z',
      },
    ]);
  });

  it('updates one SMS message, sending only the fields given and trimming the ids', async () => {
    let requestedUrl = '';
    let sentBody: unknown;
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      requestedUrl = String(url);
      sentBody = JSON.parse(String(init?.body));
      return jsonResponse(successEnvelope({ ...smsTemplatePayload(), message_code: 'fee_pending', updated_by: null }));
    }) as typeof fetch;

    const template = await buildClient().updateSmsTemplate('fee_pending', { templateIdEn: ' 20010 ', templateIdUr: '' });

    expect(requestedUrl).toBe('http://example.test/api/v1/admin/sms_templates/fee_pending');
    expect(sentBody).toEqual({ sms_template: { template_id_en: '20010', template_id_ur: '' } });
    expect(template).toMatchObject({ messageCode: 'fee_pending', updatedBy: undefined });
  });

  it('turns a 422 on an SMS message into VALIDATION_FAILED', async () => {
    globalThis.fetch = (async () =>
      jsonResponse({ errors: [{ code: 'validation_failed', message: 'Template id is invalid' }] }, { status: 422 })) as typeof fetch;

    await expect(buildClient().updateSmsTemplate('otp', { enabled: false })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      message: 'Template id is invalid',
    });
  });
});

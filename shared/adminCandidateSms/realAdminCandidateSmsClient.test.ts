import { createApiClient } from '../api-client';
import type { StaffAuthClient } from '../auth/staffTypes';
import { createAdminCandidateSmsClient } from './realAdminCandidateSmsClient';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' }, ...init });
}

const envelope = (data: unknown) => ({ data, meta: { request_id: 'req-1', timestamp: '2026-11-04T09:00:00Z' }, errors: [] });

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
  return createAdminCandidateSmsClient({
    apiClient: createApiClient({ baseUrl: 'http://example.test/api/v1' }),
    staffAuthClient: fakeStaffAuthClient(),
    getLocale: () => 'ur',
  });
}

const delivery = {
  id: 'd-1', message_code: 'visa_issued', locale: 'ur', status: 'pending', error_code: null,
  sent_by: { id: 's-1', role: 'admin' }, created_at: '2026-11-04T09:10:00Z', sent_at: null,
};

describe('createAdminCandidateSmsClient (real)', () => {
  it('loads the sendable messages and history with auth and locale headers', async () => {
    let seenUrl = '';
    let seenHeaders: Record<string, string> = {};
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      seenUrl = String(url);
      seenHeaders = init.headers as Record<string, string>;
      return jsonResponse(envelope({
        default_locale: 'ur',
        messages: [{ message_code: 'visa_issued', automatic: true, locales: ['en', 'ur'], variables: ['country'], prefilled: { ur: { country: 'قطر' } } }],
        deliveries: [{ ...delivery, sent_by: null, status: 'sent' }],
      }));
    }) as typeof fetch;

    const overview = await buildClient().getOverview('candidate-1');

    expect(seenUrl).toBe('http://example.test/api/v1/admin/candidates/candidate-1/sms_messages');
    expect(seenHeaders.Authorization).toBe('Bearer staff-access-token');
    expect(seenHeaders['X-Locale']).toBe('ur');
    expect(overview).toEqual({
      defaultLocale: 'ur',
      messages: [{ messageCode: 'visa_issued', automatic: true, locales: ['en', 'ur'], variables: ['country'], prefilled: { ur: { country: 'قطر' } } }],
      deliveries: [{ id: 'd-1', messageCode: 'visa_issued', locale: 'ur', status: 'sent', errorCode: undefined, sentBy: undefined, createdAt: '2026-11-04T09:10:00Z', sentAt: undefined }],
    });
  });

  it('sends the message with its Idempotency-Key and maps the queued SMS', async () => {
    let seenBody = '';
    let seenHeaders: Record<string, string> = {};
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      seenBody = String(init.body);
      seenHeaders = init.headers as Record<string, string>;
      return jsonResponse(envelope(delivery), { status: 201 });
    }) as typeof fetch;

    const result = await buildClient().send('candidate-1', { messageCode: 'visa_issued', locale: 'ur', variables: { country: 'قطر' } }, 'key-1');

    expect(JSON.parse(seenBody)).toEqual({ sms_message: { message_code: 'visa_issued', locale: 'ur', variables: { country: 'قطر' } } });
    expect(seenHeaders['Idempotency-Key']).toBe('key-1');
    expect(result).toMatchObject({ id: 'd-1', status: 'pending', sentBy: { id: 's-1', role: 'admin' } });
  });

  it('maps a validation error with the field it names', async () => {
    globalThis.fetch = (async () =>
      jsonResponse(
        { errors: [{ code: 'validation_failed', message: 'Fill in every value the SMS needs.', field: 'sms_message.variables.country' }], request_id: 'req-1' },
        { status: 422 }
      )) as typeof fetch;

    await expect(buildClient().send('candidate-1', { messageCode: 'visa_issued', locale: 'en', variables: {} }, 'key-2')).rejects.toEqual({
      code: 'VALIDATION_FAILED', message: 'Fill in every value the SMS needs.', field: 'sms_message.variables.country',
    });
  });
});

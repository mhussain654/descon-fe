import { createApiClient } from '../api-client';
import type { StaffAuthClient } from '../auth/staffTypes';
import { createAdminMedicalAppointmentSettingClient } from './realAdminMedicalAppointmentSettingClient';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' }, ...init });
}

const payload = {
  center_name: 'Al Shifa Medical Centre',
  center_address: null,
  appointment_on: '2026-11-20',
  appointment_time: '09:30',
  updated_by: { id: 'staff-1', role: 'admin' },
  updated_at: '2026-11-13T09:00:00Z',
};

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
  return createAdminMedicalAppointmentSettingClient({ apiClient, staffAuthClient: fakeStaffAuthClient(), getLocale: () => 'ur' });
}

describe('createAdminMedicalAppointmentSettingClient (real)', () => {
  it('reads the defaults with auth and locale headers', async () => {
    let seen: { url: string; headers: Record<string, string> } | undefined;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      seen = { url: String(url), headers: init.headers as Record<string, string> };
      return jsonResponse({ data: payload, meta: {}, errors: [] });
    }) as typeof fetch;

    const result = await buildClient().getMedicalAppointmentSetting();

    expect(seen?.url).toBe('http://example.test/api/v1/admin/medical_appointment_setting');
    expect(seen?.headers.Authorization).toBe('Bearer staff-access-token');
    expect(seen?.headers['X-Locale']).toBe('ur');
    expect(result).toEqual({
      centerName: 'Al Shifa Medical Centre', centerAddress: null, appointmentOn: '2026-11-20', appointmentTime: '09:30',
      updatedBy: { id: 'staff-1', role: 'admin' }, updatedAt: '2026-11-13T09:00:00Z',
    });
  });

  it('sends blank values as null, so they clear that default', async () => {
    let body: unknown;
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      body = JSON.parse(init.body as string);
      return jsonResponse({ data: payload, meta: {}, errors: [] });
    }) as typeof fetch;

    await buildClient().updateMedicalAppointmentSetting({
      centerName: ' Al Shifa Medical Centre ', centerAddress: '  ', appointmentOn: '2026-11-20', appointmentTime: '',
    });

    expect(body).toEqual({
      medical_appointment_setting: {
        center_name: 'Al Shifa Medical Centre', center_address: null, appointment_on: '2026-11-20', appointment_time: null,
      },
    });
  });

  it.each([
    [422, 'validation_failed', 'VALIDATION_FAILED'],
    [403, 'forbidden', 'FORBIDDEN'],
    [403, 'inactive_account', 'INACTIVE_ACCOUNT'],
    [500, 'server_error', 'SERVER_ERROR'],
  ])('maps a %s %s reply to %s', async (status, serverCode, code) => {
    globalThis.fetch = (async () =>
      jsonResponse({ errors: [{ code: serverCode, message: 'server message' }] }, { status })) as unknown as typeof fetch;

    await expect(
      buildClient().updateMedicalAppointmentSetting({ centerName: '', centerAddress: '', appointmentOn: '', appointmentTime: '9' })
    ).rejects.toMatchObject({ code });
  });
});

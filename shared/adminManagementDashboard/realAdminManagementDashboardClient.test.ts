import { createApiClient } from '../api-client';
import type { StaffAuthClient } from '../auth/staffTypes';
import { createAdminManagementDashboardClient } from './realAdminManagementDashboardClient';

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
  return { data, meta: { request_id: 'req-1', timestamp: '2026-09-04T09:00:00Z' }, errors: [] };
}

function errorEnvelope(errors: Array<{ code: string; message: string }>) {
  return { errors, request_id: 'req-1' };
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
  const staffAuthClient = fakeStaffAuthClient();
  const client = createAdminManagementDashboardClient({ apiClient, staffAuthClient, getLocale: () => 'en' });
  return { client };
}

const dashboardPayload = {
  conversion_funnel: [{ code: 'verified', count: 80, percentage: 72.0 }],
  outcome_tracking: { rejected_documents: 6, qvc_re_medical: 2, qvc_rejected: 1, qvc_no_show: 3, visa_rejected: 1 },
  mobilization: {
    by_country: [{ code: 'qa', name: 'Qatar', count: 15 }],
    by_project: [{ code: 'proj-1', name: 'Project One', count: 15 }],
  },
  mobilization_trend: [{ period: '2026-06-01', count: 15 }],
};

describe('createAdminManagementDashboardClient (real)', () => {
  it('fetches the real backend summary and maps it to camelCase', async () => {
    let seenUrl = '';
    stubFetch(async (url) => {
      seenUrl = String(url);
      return jsonResponse(successEnvelope(dashboardPayload));
    });
    const { client } = buildClient();

    const result = await client.getDashboard();

    expect(result).toEqual({
      conversionFunnel: [{ code: 'verified', count: 80, percentage: 72.0 }],
      outcomeTracking: { rejectedDocuments: 6, qvcReMedical: 2, qvcRejected: 1, qvcNoShow: 3, visaRejected: 1 },
      mobilization: {
        byCountry: [{ code: 'qa', name: 'Qatar', count: 15 }],
        byProject: [{ code: 'proj-1', name: 'Project One', count: 15 }],
      },
      mobilizationTrend: [{ period: '2026-06-01', count: 15 }],
    });
    expect(seenUrl).toBe('http://example.test/api/v1/admin/management_dashboard');
  });

  it('appends a granularity query param when given', async () => {
    let seenUrl = '';
    stubFetch(async (url) => {
      seenUrl = String(url);
      return jsonResponse(successEnvelope(dashboardPayload));
    });
    const { client } = buildClient();

    await client.getDashboard('daily');

    expect(seenUrl).toBe('http://example.test/api/v1/admin/management_dashboard?granularity=daily');
  });

  it('normalizes a 403 as FORBIDDEN', async () => {
    stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'forbidden', message: 'Not allowed' }]), { status: 403 }));
    const { client } = buildClient();

    await expect(client.getDashboard()).rejects.toEqual({ code: 'FORBIDDEN', message: 'Not allowed' });
  });
});

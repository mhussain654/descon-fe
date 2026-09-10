import { createApiClient } from '../api-client';
import type { StaffAuthClient } from '../auth/staffTypes';
import { createAdminMpsDashboardClient } from './realAdminMpsDashboardClient';

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
  const client = createAdminMpsDashboardClient({ apiClient, staffAuthClient, getLocale: () => 'en' });
  return { client };
}

const dashboardPayload = {
  workflow_stage_queue: [{ code: 'registered', position: 1, count: 12 }],
  delayed_cases: { delayed: 9, critical: 2 },
  craft_summary: [{ code: 'electrician', name: 'Electrician', total: 40, mobilized: 15 }],
  mobilization: {
    by_country: [{ code: 'qa', name: 'Qatar', count: 15 }],
    by_project: [{ code: 'proj-1', name: 'Project One', count: 15 }],
  },
  mobilization_trend: [{ period: '2026-06-01', count: 15 }],
};

describe('createAdminMpsDashboardClient (real)', () => {
  it('fetches the real backend summary and maps it to camelCase', async () => {
    let seenUrl = '';
    stubFetch(async (url) => {
      seenUrl = String(url);
      return jsonResponse(successEnvelope(dashboardPayload));
    });
    const { client } = buildClient();

    const result = await client.getDashboard();

    expect(result).toEqual({
      workflowStageQueue: [{ code: 'registered', position: 1, count: 12 }],
      delayedCases: { delayed: 9, critical: 2 },
      craftSummary: [{ code: 'electrician', name: 'Electrician', total: 40, mobilized: 15 }],
      mobilization: {
        byCountry: [{ code: 'qa', name: 'Qatar', count: 15 }],
        byProject: [{ code: 'proj-1', name: 'Project One', count: 15 }],
      },
      mobilizationTrend: [{ period: '2026-06-01', count: 15 }],
    });
    expect(seenUrl).toBe('http://example.test/api/v1/admin/mps_dashboard');
  });

  it('appends a granularity query param when given', async () => {
    let seenUrl = '';
    stubFetch(async (url) => {
      seenUrl = String(url);
      return jsonResponse(successEnvelope(dashboardPayload));
    });
    const { client } = buildClient();

    await client.getDashboard('weekly');

    expect(seenUrl).toBe('http://example.test/api/v1/admin/mps_dashboard?granularity=weekly');
  });

  it('rejects an unsupported granularity as BAD_REQUEST', async () => {
    stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'invalid_query_parameter', message: 'Bad granularity' }]), { status: 400 }));
    const { client } = buildClient();

    await expect(client.getDashboard()).rejects.toEqual({ code: 'BAD_REQUEST', message: 'Bad granularity' });
  });

  it('normalizes a 403 as FORBIDDEN', async () => {
    stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'forbidden', message: 'Not allowed' }]), { status: 403 }));
    const { client } = buildClient();

    await expect(client.getDashboard()).rejects.toEqual({ code: 'FORBIDDEN', message: 'Not allowed' });
  });
});

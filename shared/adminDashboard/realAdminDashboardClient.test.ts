import { createApiClient } from '../api-client';
import type { StaffAuthClient } from '../auth/staffTypes';
import { createAdminDashboardClient } from './realAdminDashboardClient';

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

function buildClient(locale: 'en' | 'ur' = 'en') {
  const apiClient = createApiClient({ baseUrl: 'http://example.test/api/v1' });
  const staffAuthClient = fakeStaffAuthClient();
  const client = createAdminDashboardClient({ apiClient, staffAuthClient, getLocale: () => locale });
  return { client };
}

const dashboardPayload = {
  candidate_workload: { total_active_candidates: 128 },
  workflow_stage_queue: [{ code: 'registered', position: 1, count: 12 }],
  document_review_queue: { pending_review: 6, verified: 90, rejected: 3, expired_pcc: 1, near_expiry_pcc: 2 },
  payment_summary: [{ code: 'paid', count: 88 }],
};

describe('createAdminDashboardClient (real)', () => {
  describe('getDashboard', () => {
    it('fetches the real backend summary with auth/locale headers and maps it to camelCase', async () => {
      let seenUrl = '';
      let seenInit: RequestInit | undefined;
      stubFetch(async (url, init) => {
        seenUrl = String(url);
        seenInit = init as RequestInit;
        return jsonResponse(successEnvelope(dashboardPayload));
      });
      const { client } = buildClient('ur');

      const result = await client.getDashboard();

      expect(result).toEqual({
        candidateWorkload: { totalActiveCandidates: 128 },
        workflowStageQueue: [{ code: 'registered', position: 1, count: 12 }],
        documentReviewQueue: { pendingReview: 6, verified: 90, rejected: 3, expiredPcc: 1, nearExpiryPcc: 2 },
        paymentSummary: [{ code: 'paid', count: 88 }],
      });
      expect(seenUrl).toBe('http://example.test/api/v1/admin/dashboard');
      const headers = seenInit?.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer staff-access-token');
      expect(headers['X-Locale']).toBe('ur');
    });

    it('normalizes a 403 with inactive_account as INACTIVE_ACCOUNT', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'inactive_account', message: 'Account inactive' }]), { status: 403 }));
      const { client } = buildClient();

      await expect(client.getDashboard()).rejects.toEqual({ code: 'INACTIVE_ACCOUNT', message: 'Account inactive' });
    });

    it('normalizes a 403 without inactive_account as FORBIDDEN', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'forbidden', message: 'Not allowed' }]), { status: 403 }));
      const { client } = buildClient();

      await expect(client.getDashboard()).rejects.toEqual({ code: 'FORBIDDEN', message: 'Not allowed' });
    });

    it('normalizes a 5xx as SERVER_ERROR', async () => {
      stubFetch(async () => new Response('', { status: 500 }));
      const { client } = buildClient();

      await expect(client.getDashboard()).rejects.toEqual({ code: 'SERVER_ERROR' });
    });
  });
});

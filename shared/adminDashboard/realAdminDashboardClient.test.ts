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
  conversion_funnel: [{ code: 'documents_uploaded', count: 96, percentage: 75.0 }],
  average_stage_duration_days: 4.2,
  requires_attention: [{ code: 'rejected_documents', count: 3 }],
  upcoming_activities: [
    { type: 'qvc_appointment', occurs_on: '2026-09-10', candidate_assignment_public_id: 'assignment-1', reference_number: 'REF-000123' },
  ],
  recently_updated_candidates: [
    {
      candidate_full_name: 'Ahmed Khan',
      candidate_public_id: 'candidate-1',
      candidate_assignment_public_id: 'assignment-1',
      reference_number: 'REF-000123',
      workflow_stage_code: 'under_verification',
      last_updated_at: '2026-09-04T09:48:00Z',
    },
  ],
  kpi_trends: {
    active_candidates: [{ date: '2026-09-04', count: 5 }],
    paid_payments: [{ date: '2026-09-04', count: 4 }],
    mobilized: [{ date: '2026-09-04', count: 2 }],
  },
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
        conversionFunnel: [{ code: 'documents_uploaded', count: 96, percentage: 75.0 }],
        averageStageDurationDays: 4.2,
        requiresAttention: [{ code: 'rejected_documents', count: 3 }],
        upcomingActivities: [
          { type: 'qvc_appointment', occursOn: '2026-09-10', candidateAssignmentPublicId: 'assignment-1', referenceNumber: 'REF-000123' },
        ],
        recentlyUpdatedCandidates: [
          {
            candidateFullName: 'Ahmed Khan',
            candidatePublicId: 'candidate-1',
            candidateAssignmentPublicId: 'assignment-1',
            referenceNumber: 'REF-000123',
            workflowStageCode: 'under_verification',
            lastUpdatedAt: '2026-09-04T09:48:00Z',
          },
        ],
        kpiTrends: {
          activeCandidates: [{ date: '2026-09-04', count: 5 }],
          paidPayments: [{ date: '2026-09-04', count: 4 }],
          mobilized: [{ date: '2026-09-04', count: 2 }],
        },
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

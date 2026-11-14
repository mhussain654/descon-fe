import { createApiClient } from '../api-client';
import type { StaffAuthClient } from '../auth/staffTypes';
import { buildJobLogListQuery, createAdminJobLogsClient } from './realAdminJobLogsClient';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' }, ...init });
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
  return createAdminJobLogsClient({ apiClient, staffAuthClient: fakeStaffAuthClient(), getLocale: () => 'ur' });
}

const failedRow = {
  id: 812,
  active_job_id: 'job-uuid',
  job_class: 'Payments::IssueFeeVoucherJob',
  queue_name: 'default',
  priority: 0,
  status: 'failed',
  attempt: 5,
  enqueued_at: '2026-11-14T08:00:00Z',
  scheduled_at: '2026-11-14T08:00:00Z',
  started_at: null,
  finished_at: null,
  failed_at: '2026-11-14T08:00:03Z',
  error: { exception_class: 'Faraday::TimeoutError', message: 'execution expired', backtrace: ['app/services/x.rb:1'] },
};

describe('buildJobLogListQuery', () => {
  it('leaves out unset values', () => {
    expect(buildJobLogListQuery({}, {})).toBe('');
  });

  it('encodes every filter and the page', () => {
    expect(
      buildJobLogListQuery(
        { jobClass: 'CandidateSms::DeliveryJob', status: 'failed', enqueuedFrom: '2026-11-01', enqueuedTo: '2026-11-14' },
        { number: 2, size: 50 }
      )
    ).toBe(
      '?filter%5Bjob_class%5D=CandidateSms%3A%3ADeliveryJob&filter%5Bstatus%5D=failed' +
        '&filter%5Benqueued_from%5D=2026-11-01&filter%5Benqueued_to%5D=2026-11-14&page%5Bnumber%5D=2&page%5Bsize%5D=50'
    );
  });
});

describe('createAdminJobLogsClient (real)', () => {
  it('lists runs with auth and locale headers and maps the error, pagination and job classes', async () => {
    let seen: { url: string; headers: Record<string, string> } | undefined;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      seen = { url: String(url), headers: init.headers as Record<string, string> };
      return jsonResponse({
        data: [failedRow],
        meta: {
          pagination: { page: 1, per_page: 25, total_count: 1, total_pages: 1 },
          job_classes: ['CandidateSms::DeliveryJob', 'Payments::IssueFeeVoucherJob'],
        },
        errors: [],
      });
    }) as typeof fetch;

    const result = await buildClient().listJobLogs({ status: 'failed' }, {});

    expect(seen?.url).toBe('http://example.test/api/v1/admin/job_logs?filter%5Bstatus%5D=failed');
    expect(seen?.headers.Authorization).toBe('Bearer staff-access-token');
    expect(seen?.headers['X-Locale']).toBe('ur');
    expect(result.items[0]).toEqual({
      id: 812,
      activeJobId: 'job-uuid',
      jobClass: 'Payments::IssueFeeVoucherJob',
      queueName: 'default',
      priority: 0,
      status: 'failed',
      attempt: 5,
      enqueuedAt: '2026-11-14T08:00:00Z',
      scheduledAt: '2026-11-14T08:00:00Z',
      startedAt: undefined,
      finishedAt: undefined,
      failedAt: '2026-11-14T08:00:03Z',
      error: { exceptionClass: 'Faraday::TimeoutError', message: 'execution expired', backtrace: ['app/services/x.rb:1'] },
    });
    expect(result.pagination).toEqual({ page: 1, perPage: 25, totalCount: 1, totalPages: 1 });
    expect(result.jobClasses).toEqual(['CandidateSms::DeliveryJob', 'Payments::IssueFeeVoucherJob']);
  });

  it.each([
    [400, 'invalid_query_parameter', 'BAD_REQUEST'],
    [403, 'forbidden', 'FORBIDDEN'],
    [403, 'inactive_account', 'INACTIVE_ACCOUNT'],
    [500, 'server_error', 'SERVER_ERROR'],
  ])('maps a %s %s reply to %s', async (status, serverCode, code) => {
    globalThis.fetch = (async () =>
      jsonResponse({ errors: [{ code: serverCode, message: 'server message' }] }, { status })) as unknown as typeof fetch;

    await expect(buildClient().listJobLogs({}, {})).rejects.toMatchObject({ code });
  });
});

import { createApiClient } from '../api-client';
import type { StaffAuthClient } from '../auth/staffTypes';
import { createAdminReportsClient } from './realAdminReportsClient';

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

function successEnvelope(data: unknown) {
  return { data, meta: { request_id: 'req-1', timestamp: '2026-09-04T09:00:00Z' }, errors: [] };
}

function errorEnvelope(errors: Array<{ code: string; message: string; field?: string }>) {
  return { errors, request_id: 'req-1' };
}

/** Both authenticatedDataRequest (JSON endpoints) and authenticatedRequest (the binary export) just attach a fixed token and rethrow whatever `makeRequest` throws -- their own refresh/401 behavior is covered separately in realStaffAuthClient.test.ts, same rationale as realAdminAuditEventsClient.test.ts's fake. */
function fakeStaffAuthClient(): StaffAuthClient {
  return {
    signIn: async () => {
      throw new Error('not used');
    },
    restoreSession: async () => null,
    signOut: async () => undefined,
    authenticatedRequest: async (makeRequest) => makeRequest('staff-access-token'),
    authenticatedDataRequest: async (makeRequest) => makeRequest('staff-access-token'),
  };
}

function buildClient(locale: 'en' | 'ur' = 'en') {
  const apiClient = createApiClient({ baseUrl: 'http://example.test/api/v1' });
  const staffAuthClient = fakeStaffAuthClient();
  const client = createAdminReportsClient({ apiClient, staffAuthClient, getLocale: () => locale });
  return { client };
}

describe('createAdminReportsClient (real)', () => {
  describe('listReportTypes', () => {
    it('fetches the real backend catalogue with auth/locale headers', async () => {
      let seenUrl = '';
      let seenInit: RequestInit | undefined;
      stubFetch(async (url, init) => {
        seenUrl = String(url);
        seenInit = init as RequestInit;
        return jsonResponse(successEnvelope(['status_summary', 'mobilization']));
      });
      const { client } = buildClient('ur');

      const result = await client.listReportTypes();

      expect(result).toEqual(['status_summary', 'mobilization']);
      expect(seenUrl).toBe('http://example.test/api/v1/admin/reports');
      const headers = seenInit?.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer staff-access-token');
      expect(headers['X-Locale']).toBe('ur');
    });

    it('normalizes a 403 as FORBIDDEN', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'forbidden', message: 'Not allowed' }]), { status: 403 }));
      const { client } = buildClient();

      await expect(client.listReportTypes()).rejects.toEqual({ code: 'FORBIDDEN', message: 'Not allowed' });
    });
  });

  describe('getReportData', () => {
    it('maps a status_summary response into rows', async () => {
      stubFetch(async () =>
        jsonResponse(successEnvelope([{ code: 'registered', position: 1, count: 2 }]))
      );
      const { client } = buildClient();

      const result = await client.getReportData('status_summary');

      expect(result).toEqual({ type: 'status_summary', rows: [{ code: 'registered', position: 1, count: 2 }] });
    });

    it('maps a mobilization response into a camelCase summary', async () => {
      stubFetch(async () =>
        jsonResponse(
          successEnvelope({
            by_country: [{ code: 'qa', name: 'Qatar', count: 5 }],
            by_project: [{ code: 'p1', name: 'Project One', count: 5 }],
          })
        )
      );
      const { client } = buildClient();

      const result = await client.getReportData('mobilization');

      expect(result).toEqual({
        type: 'mobilization',
        summary: {
          byCountry: [{ code: 'qa', name: 'Qatar', count: 5 }],
          byProject: [{ code: 'p1', name: 'Project One', count: 5 }],
        },
      });
    });

    it('maps an outcome_tracking response into a flat summary', async () => {
      const payload = { rejected_documents: 1, qvc_re_medical: 0, qvc_rejected: 0, qvc_no_show: 0, visa_rejected: 1 };
      stubFetch(async () => jsonResponse(successEnvelope(payload)));
      const { client } = buildClient();

      const result = await client.getReportData('outcome_tracking');

      expect(result).toEqual({ type: 'outcome_tracking', summary: payload });
    });

    it('appends a granularity query param for the trend report only', async () => {
      let seenUrl = '';
      stubFetch(async (url) => {
        seenUrl = String(url);
        return jsonResponse(successEnvelope([{ period: '2026-06-01', count: 3 }]));
      });
      const { client } = buildClient();

      await client.getReportData('trend', { granularity: 'daily' });

      expect(seenUrl).toBe('http://example.test/api/v1/admin/reports/trend?granularity=daily');
    });

    it('rejects an unknown report_type as BAD_REQUEST', async () => {
      stubFetch(async () =>
        jsonResponse(errorEnvelope([{ code: 'invalid_query_parameter', message: 'Unknown report', field: 'report_type' }]), {
          status: 400,
        })
      );
      const { client } = buildClient();

      await expect(client.getReportData('status_summary')).rejects.toEqual({
        code: 'BAD_REQUEST',
        message: 'Unknown report',
        field: 'report_type',
      });
    });
  });

  describe('exportReport', () => {
    it('fetches the binary export and returns its blob and server-provided filename', async () => {
      let seenUrl = '';
      let seenInit: RequestInit | undefined;
      stubFetch(async (url, init) => {
        seenUrl = String(url);
        seenInit = init as RequestInit;
        return new Response(new Blob(['csv-bytes']), {
          status: 200,
          headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="status_summary.csv"' },
        });
      });
      const { client } = buildClient();

      const result = await client.exportReport('status_summary', 'csv');

      expect(seenUrl).toBe('http://example.test/api/v1/admin/reports/status_summary/export?format=csv');
      expect(result.filename).toBe('status_summary.csv');
      const headers = seenInit?.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer staff-access-token');
    });

    it('includes the granularity param for a trend export', async () => {
      let seenUrl = '';
      stubFetch(async (url) => {
        seenUrl = String(url);
        return new Response(new Blob(['pdf-bytes']), { status: 200, headers: { 'Content-Type': 'application/pdf' } });
      });
      const { client } = buildClient();

      await client.exportReport('trend', 'pdf', { granularity: 'weekly' });

      expect(seenUrl).toBe('http://example.test/api/v1/admin/reports/trend/export?format=pdf&granularity=weekly');
    });

    it('falls back to a client-built filename when Content-Disposition is missing', async () => {
      stubFetch(async () => new Response(new Blob(['x']), { status: 200 }));
      const { client } = buildClient();

      const result = await client.exportReport('craft_summary', 'xlsx');

      expect(result.filename).toBe('craft_summary.xlsx');
    });

    it('rejects an unsupported format as BAD_REQUEST', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'invalid_query_parameter', message: 'Unknown format' }]), { status: 400 }));
      const { client } = buildClient();

      await expect(client.exportReport('status_summary', 'csv')).rejects.toEqual({ code: 'BAD_REQUEST', message: 'Unknown format' });
    });
  });
});

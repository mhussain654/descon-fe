import { createApiClient } from '../api-client';
import { createCandidateVisaDecisionsClient } from './realCandidateVisaDecisionsClient';

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
  return { data, meta: { request_id: 'req-1', timestamp: '2026-09-15T10:00:00Z' }, errors: [] };
}

function errorEnvelope(errors: Array<{ code: string; message: string }>) {
  return { errors, request_id: 'req-1', timestamp: '2026-09-15T10:00:00Z' };
}

function visaDecisionPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: '9b8a5883-70d5-4040-8823-424f4b4b669b',
    outcome_code: 'issued',
    decision_date: '2026-09-05',
    rejection_reason_code: null,
    visa_copy_attached: true,
    created_at: '2026-09-05T10:00:00Z',
    ...overrides,
  };
}

function buildClient(locale: 'en' | 'ur' = 'en') {
  const apiClient = createApiClient({ baseUrl: 'http://example.test/api/v1' });
  return createCandidateVisaDecisionsClient({ apiClient, getLocale: () => locale });
}

describe('createCandidateVisaDecisionsClient (real) -- listVisaDecisions', () => {
  it('fetches with the bearer token and locale headers', async () => {
    let seenUrl = '';
    let seenHeaders: Record<string, string> = {};
    stubFetch(async (url, init) => {
      seenUrl = String(url);
      seenHeaders = (init as RequestInit)?.headers as Record<string, string>;
      return jsonResponse(successEnvelope({ assignment_id: 'assignment-1', visa_decisions: [] }));
    });

    const client = buildClient('ur');
    await client.listVisaDecisions('candidate-access-token');

    expect(seenUrl).toBe('http://example.test/api/v1/candidate/visa_decisions');
    expect(seenHeaders.Authorization).toBe('Bearer candidate-access-token');
    expect(seenHeaders['X-Locale']).toBe('ur');
  });

  it('resolves an empty list when no visa decisions have been recorded yet, not an error', async () => {
    stubFetch(async () => jsonResponse(successEnvelope({ assignment_id: null, visa_decisions: [] })));

    const client = buildClient();
    await expect(client.listVisaDecisions('token')).resolves.toEqual([]);
  });

  it('maps a recorded visa decision, snake_case to camelCase', async () => {
    stubFetch(async () =>
      jsonResponse(successEnvelope({ assignment_id: 'assignment-1', visa_decisions: [visaDecisionPayload()] }))
    );

    const client = buildClient();
    const decisions = await client.listVisaDecisions('token');

    expect(decisions).toEqual([
      {
        id: '9b8a5883-70d5-4040-8823-424f4b4b669b',
        outcomeCode: 'issued',
        decisionDate: '2026-09-05',
        rejectionReasonCode: null,
        visaCopyAttached: true,
        createdAt: '2026-09-05T10:00:00Z',
      },
    ]);
  });

  it('maps a rejected decision with its rejection reason and no attached copy', async () => {
    stubFetch(async () =>
      jsonResponse(
        successEnvelope({
          assignment_id: 'assignment-1',
          visa_decisions: [
            visaDecisionPayload({
              outcome_code: 'rejected',
              rejection_reason_code: 'document_discrepancy',
              visa_copy_attached: false,
            }),
          ],
        })
      )
    );

    const client = buildClient();
    const [decision] = await client.listVisaDecisions('token');

    expect(decision.outcomeCode).toBe('rejected');
    expect(decision.rejectionReasonCode).toBe('document_discrepancy');
    expect(decision.visaCopyAttached).toBe(false);
  });

  it('maps a 401 to SESSION_EXPIRED', async () => {
    stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'unauthorized', message: 'Session expired.' }]), { status: 401 }));

    const client = buildClient();
    await expect(client.listVisaDecisions('token')).rejects.toEqual({ code: 'SESSION_EXPIRED' });
  });

  it('maps a 403 inactive_account to INACTIVE_ACCOUNT', async () => {
    stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'inactive_account', message: 'Inactive.' }]), { status: 403 }));

    const client = buildClient();
    await expect(client.listVisaDecisions('token')).rejects.toEqual({ code: 'INACTIVE_ACCOUNT', message: 'Inactive.' });
  });

  it('maps a network failure to NETWORK_ERROR', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });

    const client = buildClient();
    await expect(client.listVisaDecisions('token')).rejects.toEqual({ code: 'NETWORK_ERROR' });
  });
});

describe('createCandidateVisaDecisionsClient (real) -- requestVisaCopyAccess', () => {
  it('POSTs with the bearer token and locale headers, and maps the response', async () => {
    let seenUrl = '';
    let seenInit: RequestInit | undefined;
    stubFetch(async (url, init) => {
      seenUrl = String(url);
      seenInit = init as RequestInit;
      return jsonResponse(
        successEnvelope({
          visa_decision_id: '9b8a5883-70d5-4040-8823-424f4b4b669b',
          url: '/rails/active_storage/blobs/proxy/abc/visa.pdf',
          expires_at: '2026-09-15T10:05:00Z',
        })
      );
    });

    const client = buildClient('ur');
    const access = await client.requestVisaCopyAccess('candidate-access-token', '9b8a5883-70d5-4040-8823-424f4b4b669b');

    expect(seenUrl).toBe(
      'http://example.test/api/v1/candidate/visa_decisions/9b8a5883-70d5-4040-8823-424f4b4b669b/visa_copy_access'
    );
    expect(seenInit?.method).toBe('POST');
    const headers = seenInit?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer candidate-access-token');
    expect(headers['X-Locale']).toBe('ur');
    expect(access).toEqual({
      visaDecisionId: '9b8a5883-70d5-4040-8823-424f4b4b669b',
      url: '/rails/active_storage/blobs/proxy/abc/visa.pdf',
      expiresAt: '2026-09-15T10:05:00Z',
    });
  });

  it('maps a 404 to NOT_FOUND', async () => {
    stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'not_found', message: 'Visa decision not found.' }]), { status: 404 }));

    const client = buildClient();
    await expect(client.requestVisaCopyAccess('token', 'decision-1')).rejects.toEqual({
      code: 'NOT_FOUND',
      message: 'Visa decision not found.',
    });
  });

  it('maps a 422 document_attachment_missing to VISA_COPY_NOT_ATTACHED', async () => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: 'document_attachment_missing', message: 'No visa copy attached.' }]), { status: 422 })
    );

    const client = buildClient();
    await expect(client.requestVisaCopyAccess('token', 'decision-1')).rejects.toEqual({
      code: 'VISA_COPY_NOT_ATTACHED',
      message: 'No visa copy attached.',
    });
  });

  it('maps a 401 to SESSION_EXPIRED', async () => {
    stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'unauthorized', message: 'Expired.' }]), { status: 401 }));

    const client = buildClient();
    await expect(client.requestVisaCopyAccess('token', 'decision-1')).rejects.toEqual({ code: 'SESSION_EXPIRED' });
  });

  it('maps a 429 to RATE_LIMITED with the Retry-After seconds', async () => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: 'rate_limited', message: 'Too many requests.' }]), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '20' },
      })
    );

    const client = buildClient();
    await expect(client.requestVisaCopyAccess('token', 'decision-1')).rejects.toEqual({ code: 'RATE_LIMITED', retryAfterSeconds: 20 });
  });

  it('maps a 5xx to SERVER_ERROR', async () => {
    stubFetch(async () => new Response('Internal Server Error', { status: 500 }));

    const client = buildClient();
    await expect(client.requestVisaCopyAccess('token', 'decision-1')).rejects.toEqual({ code: 'SERVER_ERROR' });
  });

  it('maps a network failure to NETWORK_ERROR', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });

    const client = buildClient();
    await expect(client.requestVisaCopyAccess('token', 'decision-1')).rejects.toEqual({ code: 'NETWORK_ERROR' });
  });
});

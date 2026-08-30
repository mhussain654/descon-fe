// Framework-agnostic: runs under both web's Vitest and mobile's Jest.
import { createApiClient } from '../api-client';
import { createCandidateWorkflowHistoryClient } from './realCandidateWorkflowClient';

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
  return { data, meta: { request_id: 'req-1', timestamp: '2026-08-26T09:00:00Z' }, errors: [] };
}

function errorEnvelope(errors: Array<{ code: string; message: string; field?: string }>) {
  return { errors, request_id: 'req-1' };
}

function historyPayload(overrides: Record<string, unknown> = {}) {
  return {
    candidate_id: 'candidate-public-id-1',
    assignment_id: 'assignment-public-id-1',
    history: [
      {
        from_stage: null,
        to_stage: { code: 'registered', name: 'Registered', position: 1 },
        occurred_at: '2026-08-01T00:00:00Z',
        reason_code: null,
        details: null,
      },
      {
        from_stage: { code: 'qvc_appointment_booked', name: 'QVC Appointment Booked', position: 9 },
        to_stage: { code: 'qvc_completed_outcome_received', name: 'QVC Completed / Outcome Received', position: 10 },
        occurred_at: '2026-08-10T00:00:00Z',
        reason_code: null,
        details: { qvc_outcome_code: 'approved', qvc_outcome_date: '2026-08-10' },
      },
    ],
    updated_at: '2026-08-10T00:00:00Z',
    ...overrides,
  };
}

function buildClient(locale: 'en' | 'ur' = 'en') {
  const apiClient = createApiClient({ baseUrl: 'http://example.test/api/v1' });
  return createCandidateWorkflowHistoryClient({ apiClient, getLocale: () => locale });
}

describe('createCandidateWorkflowHistoryClient (real)', () => {
  it('fetches workflow history with the bearer token and locale, mapping snake_case fields to the client shape', async () => {
    let seenUrl = '';
    let seenHeaders: Record<string, string> = {};
    stubFetch(async (url, init) => {
      seenUrl = String(url);
      seenHeaders = (init as RequestInit)?.headers as Record<string, string>;
      return jsonResponse(successEnvelope(historyPayload()));
    });

    const client = buildClient('ur');
    const history = await client.getWorkflowHistory('candidate-access-token');

    expect(seenUrl).toBe('http://example.test/api/v1/candidate/workflow_history');
    expect(seenHeaders.Authorization).toBe('Bearer candidate-access-token');
    expect(seenHeaders['X-Locale']).toBe('ur');
    expect(history).toEqual({
      items: [
        {
          fromStage: null,
          toStage: { code: 'registered', name: 'Registered', position: 1 },
          occurredAt: '2026-08-01T00:00:00Z',
          reasonCode: null,
          details: null,
        },
        {
          fromStage: { code: 'qvc_appointment_booked', name: 'QVC Appointment Booked', position: 9 },
          toStage: { code: 'qvc_completed_outcome_received', name: 'QVC Completed / Outcome Received', position: 10 },
          occurredAt: '2026-08-10T00:00:00Z',
          reasonCode: null,
          details: { qvcOutcomeCode: 'approved', qvcOutcomeDate: '2026-08-10' },
        },
      ],
      updatedAt: '2026-08-10T00:00:00Z',
    });
  });

  it('never sends a candidate id in the request path -- identity comes only from the bearer token', async () => {
    let seenUrl = '';
    stubFetch(async (url) => {
      seenUrl = String(url);
      return jsonResponse(successEnvelope(historyPayload()));
    });

    const client = buildClient();
    await client.getWorkflowHistory('candidate-access-token');

    expect(seenUrl).not.toMatch(/candidate-access-token|candidate-public-id-1/);
  });

  it('maps an empty history array through unchanged', async () => {
    stubFetch(async () => jsonResponse(successEnvelope(historyPayload({ history: [] }))));

    const client = buildClient();
    const history = await client.getWorkflowHistory('token');

    expect(history.items).toEqual([]);
  });

  it('drops a malformed history item (missing to_stage) rather than crashing or fabricating one', async () => {
    stubFetch(async () =>
      jsonResponse(
        successEnvelope(
          historyPayload({
            history: [historyPayload().history[0], { occurred_at: '2026-08-05T00:00:00Z' }],
          })
        )
      )
    );

    const client = buildClient();
    const history = await client.getWorkflowHistory('token');

    expect(history.items).toHaveLength(1);
  });

  it('drops an unrecognized qvc_outcome_code rather than showing a raw future code', async () => {
    stubFetch(async () =>
      jsonResponse(
        successEnvelope(
          historyPayload({
            history: [
              {
                from_stage: { code: 'qvc_appointment_booked', name: 'QVC Appointment Booked', position: 9 },
                to_stage: { code: 'qvc_completed_outcome_received', name: 'QVC Completed / Outcome Received', position: 10 },
                occurred_at: '2026-08-10T00:00:00Z',
                reason_code: null,
                details: { qvc_outcome_code: 'some_future_outcome', qvc_outcome_date: '2026-08-10' },
              },
            ],
          })
        )
      )
    );

    const client = buildClient();
    const history = await client.getWorkflowHistory('token');

    expect(history.items[0].details).toEqual({ qvcOutcomeDate: '2026-08-10' });
  });

  it('maps a 401 to SESSION_EXPIRED', async () => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: 'unauthorized', message: 'Session expired.' }]), { status: 401 })
    );

    const client = buildClient();
    await expect(client.getWorkflowHistory('token')).rejects.toEqual({ code: 'SESSION_EXPIRED' });
  });

  it('maps a 403 inactive_account to INACTIVE_ACCOUNT', async () => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: 'inactive_account', message: 'This account is inactive.' }]), {
        status: 403,
      })
    );

    const client = buildClient();
    await expect(client.getWorkflowHistory('token')).rejects.toEqual({ code: 'INACTIVE_ACCOUNT' });
  });

  it('maps an unrecognized 403 to FORBIDDEN', async () => {
    stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'something_else', message: 'Nope.' }]), { status: 403 }));

    const client = buildClient();
    await expect(client.getWorkflowHistory('token')).rejects.toEqual({ code: 'FORBIDDEN' });
  });

  it('maps a 429 to RATE_LIMITED with the Retry-After seconds', async () => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: 'rate_limited', message: 'Too many requests.' }]), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '15' },
      })
    );

    const client = buildClient();
    await expect(client.getWorkflowHistory('token')).rejects.toEqual({ code: 'RATE_LIMITED', retryAfterSeconds: 15 });
  });

  it('maps a 5xx to SERVER_ERROR', async () => {
    stubFetch(async () => new Response('Internal Server Error', { status: 500 }));

    const client = buildClient();
    await expect(client.getWorkflowHistory('token')).rejects.toEqual({ code: 'SERVER_ERROR' });
  });

  it('maps a network failure to NETWORK_ERROR', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });

    const client = buildClient();
    await expect(client.getWorkflowHistory('token')).rejects.toEqual({ code: 'NETWORK_ERROR' });
  });

  it('maps offline to OFFLINE', async () => {
    const apiClient = createApiClient({ baseUrl: 'http://example.test/api/v1', isOnline: () => false });
    const client = createCandidateWorkflowHistoryClient({ apiClient, getLocale: () => 'en' });
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });

    await expect(client.getWorkflowHistory('token')).rejects.toEqual({ code: 'OFFLINE' });
  });
});

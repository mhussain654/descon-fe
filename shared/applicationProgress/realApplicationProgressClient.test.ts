// Runs under both web's Vitest and mobile's Jest, matching
// shared/candidateDocuments/realCandidateDocumentsClient.test.ts's pattern.
import { createApiClient } from '../api-client';
import { createApplicationProgressClient } from './realApplicationProgressClient';

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

function errorEnvelope(errors: Array<{ code: string; message: string; details?: unknown }>) {
  return { errors, request_id: 'req-1', timestamp: '2026-08-26T09:00:00Z' };
}

function progressPayload(overrides: Record<string, unknown> = {}) {
  return {
    candidate_status: 'registered',
    current_workflow_stage: { code: 'registered', name: 'Registered' },
    documents: {
      required_total: 1,
      missing: 0,
      uploaded: 1,
      pending_review: 0,
      verified: 0,
      rejected: 0,
      submitted_total: 1,
      completion_percentage: 100,
      can_submit: true,
      submission_state: 'ready',
      blocking_requirements: [],
    },
    ...overrides,
  };
}

function submissionResultPayload(overrides: Record<string, unknown> = {}) {
  return {
    message: 'Documents submitted for review.',
    submission_id: '0f5b8c9a-4f88-440d-94eb-cf70f780ff95',
    submitted_at: '2026-08-26T12:00:00Z',
    submission_state: 'submitted',
    documents: { required_total: 1, pending_review: 1, can_submit: false },
    ...overrides,
  };
}

function buildClient(locale: 'en' | 'ur' = 'en') {
  const apiClient = createApiClient({ baseUrl: 'http://example.test/api/v1' });
  return createApplicationProgressClient({ apiClient, getLocale: () => locale });
}

function buildOfflineClient() {
  const apiClient = createApiClient({ baseUrl: 'http://example.test/api/v1', isOnline: () => false });
  return createApplicationProgressClient({ apiClient, getLocale: () => 'en' });
}

describe('createApplicationProgressClient (real) -- getProgress', () => {
  it('fetches progress with the bearer token and locale headers', async () => {
    let seenUrl = '';
    let seenHeaders: Record<string, string> = {};
    stubFetch(async (url, init) => {
      seenUrl = String(url);
      seenHeaders = (init as RequestInit)?.headers as Record<string, string>;
      return jsonResponse(successEnvelope(progressPayload()));
    });

    const client = buildClient('ur');
    await client.getProgress('candidate-access-token');

    expect(seenUrl).toBe('http://example.test/api/v1/candidate/application_progress');
    expect(seenHeaders.Authorization).toBe('Bearer candidate-access-token');
    expect(seenHeaders['X-Locale']).toBe('ur');
  });

  it('never sends a candidate id in the request path -- identity comes only from the bearer token', async () => {
    let seenUrl = '';
    stubFetch(async (url) => {
      seenUrl = String(url);
      return jsonResponse(successEnvelope(progressPayload()));
    });

    const client = buildClient();
    await client.getProgress('candidate-access-token-xyz');

    expect(seenUrl).not.toContain('candidate-access-token-xyz');
  });

  it('maps every field of a ready progress response', async () => {
    stubFetch(async () => jsonResponse(successEnvelope(progressPayload())));
    const client = buildClient();
    const progress = await client.getProgress('token');

    expect(progress).toEqual({
      candidateStatus: 'registered',
      currentWorkflowStage: { code: 'registered', name: 'Registered' },
      documents: {
        requiredTotal: 1,
        missing: 0,
        uploaded: 1,
        pendingReview: 0,
        verified: 0,
        rejected: 0,
        submittedTotal: 1,
        completionPercentage: 100,
        canSubmit: true,
        submissionState: 'ready',
        blockingRequirements: [],
      },
    });
  });

  it('maps a null current_workflow_stage (no assignment) to null', async () => {
    stubFetch(async () =>
      jsonResponse(
        successEnvelope(
          progressPayload({
            current_workflow_stage: null,
            documents: {
              required_total: 0,
              missing: 0,
              uploaded: 0,
              pending_review: 0,
              verified: 0,
              rejected: 0,
              submitted_total: 0,
              completion_percentage: 0,
              can_submit: false,
              submission_state: 'no_assignment',
              blocking_requirements: [],
            },
          })
        )
      )
    );
    const client = buildClient();
    const progress = await client.getProgress('token');

    expect(progress.currentWorkflowStage).toBeNull();
    expect(progress.documents.submissionState).toBe('no_assignment');
    expect(progress.documents.canSubmit).toBe(false);
  });

  it.each(['no_assignment', 'no_requirements', 'incomplete', 'ready', 'submitted', 'partially_verified', 'verified', 'changes_required'])(
    'maps the %s submission state through unchanged',
    async (state) => {
      stubFetch(async () =>
        jsonResponse(successEnvelope(progressPayload({ documents: { ...progressPayload().documents, submission_state: state } })))
      );
      const client = buildClient();
      const progress = await client.getProgress('token');
      expect(progress.documents.submissionState).toBe(state);
    }
  );

  it('falls back an unrecognized submission_state to "unknown" rather than crashing', async () => {
    stubFetch(async () =>
      jsonResponse(
        successEnvelope(progressPayload({ documents: { ...progressPayload().documents, submission_state: 'some_future_state' } }))
      )
    );
    const client = buildClient();
    const progress = await client.getProgress('token');
    expect(progress.documents.submissionState).toBe('unknown');
  });

  it('maps blocking requirements, including an unrecognized reason falling back to "unknown"', async () => {
    stubFetch(async () =>
      jsonResponse(
        successEnvelope(
          progressPayload({
            documents: {
              ...progressPayload().documents,
              can_submit: false,
              submission_state: 'incomplete',
              blocking_requirements: [
                { requirement_code: 'passport', name: 'Passport', reason: 'missing' },
                { requirement_code: 'cnic_front', name: 'CNIC (Front)', reason: 'rejected' },
                { requirement_code: 'weird', name: 'Weird', reason: 'a_future_reason' },
              ],
            },
          })
        )
      )
    );
    const client = buildClient();
    const progress = await client.getProgress('token');

    expect(progress.documents.blockingRequirements).toEqual([
      { requirementCode: 'passport', name: 'Passport', reason: 'missing' },
      { requirementCode: 'cnic_front', name: 'CNIC (Front)', reason: 'rejected' },
      { requirementCode: 'weird', name: 'Weird', reason: 'unknown' },
    ]);
  });

  it('drops a malformed blocking requirement with no requirement_code instead of crashing', async () => {
    stubFetch(async () =>
      jsonResponse(
        successEnvelope(
          progressPayload({
            documents: {
              ...progressPayload().documents,
              blocking_requirements: [{ name: 'No code', reason: 'missing' }],
            },
          })
        )
      )
    );
    const client = buildClient();
    const progress = await client.getProgress('token');
    expect(progress.documents.blockingRequirements).toEqual([]);
  });

  it.each([
    ['inactive_account', 403, 'INACTIVE_ACCOUNT'],
  ])('maps a %s error to %s', async (serverCode, status, expectedCode) => {
    stubFetch(async () => jsonResponse(errorEnvelope([{ code: serverCode, message: 'nope' }]), { status }));
    const client = buildClient();
    await expect(client.getProgress('token')).rejects.toMatchObject({ code: expectedCode });
  });

  it('maps a 401 to SESSION_EXPIRED', async () => {
    stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'unauthorized', message: 'nope' }]), { status: 401 }));
    const client = buildClient();
    await expect(client.getProgress('token')).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
  });

  it('maps offline to OFFLINE', async () => {
    const client = buildOfflineClient();
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });

    await expect(client.getProgress('token')).rejects.toEqual({ code: 'OFFLINE' });
  });
});

describe('createApplicationProgressClient (real) -- submitDocuments', () => {
  it('submits with an empty body and the bearer/locale/idempotency headers', async () => {
    let seenUrl = '';
    let seenHeaders: Record<string, string> = {};
    let seenBody: unknown;
    stubFetch(async (url, init) => {
      seenUrl = String(url);
      seenHeaders = (init as RequestInit)?.headers as Record<string, string>;
      seenBody = (init as RequestInit)?.body;
      return jsonResponse(successEnvelope(submissionResultPayload()), { status: 201 });
    });

    const client = buildClient('ur');
    await client.submitDocuments({ accessToken: 'candidate-access-token', idempotencyKey: 'key-1' });

    expect(seenUrl).toBe('http://example.test/api/v1/candidate/document_submissions');
    expect(seenHeaders.Authorization).toBe('Bearer candidate-access-token');
    expect(seenHeaders['X-Locale']).toBe('ur');
    expect(seenHeaders['Idempotency-Key']).toBe('key-1');
    expect(seenBody).toBeUndefined();
  });

  it('never sends a candidate id, assignment id, document id or requirement code', async () => {
    let seenUrl = '';
    let seenBody: unknown;
    stubFetch(async (url, init) => {
      seenUrl = String(url);
      seenBody = (init as RequestInit)?.body;
      return jsonResponse(successEnvelope(submissionResultPayload()), { status: 201 });
    });

    const client = buildClient();
    await client.submitDocuments({ accessToken: 'candidate-access-token-xyz', idempotencyKey: 'key-1' });

    expect(seenUrl).not.toContain('candidate-access-token-xyz');
    expect(seenBody).toBeUndefined();
  });

  it('maps a successful submission response', async () => {
    stubFetch(async () => jsonResponse(successEnvelope(submissionResultPayload()), { status: 201 }));
    const client = buildClient();
    const result = await client.submitDocuments({ accessToken: 'token', idempotencyKey: 'key-1' });

    expect(result).toEqual({
      message: 'Documents submitted for review.',
      submissionId: '0f5b8c9a-4f88-440d-94eb-cf70f780ff95',
      submittedAt: '2026-08-26T12:00:00Z',
      submissionState: 'submitted',
      documents: { requiredTotal: 1, pendingReview: 1, canSubmit: false },
    });
  });

  it.each([
    ['no_current_assignment', 422, 'NO_CURRENT_ASSIGNMENT'],
    ['no_document_requirements', 422, 'NO_DOCUMENT_REQUIREMENTS'],
    ['documents_incomplete', 422, 'DOCUMENTS_INCOMPLETE'],
    ['documents_rejected', 422, 'DOCUMENTS_REJECTED'],
    ['submission_not_allowed', 422, 'SUBMISSION_NOT_ALLOWED'],
    ['already_submitted', 422, 'ALREADY_SUBMITTED'],
    ['idempotency_conflict', 409, 'CONFLICT'],
    ['idempotency_in_progress', 409, 'IN_PROGRESS'],
    ['inactive_account', 403, 'INACTIVE_ACCOUNT'],
  ])('maps a %s error to %s', async (serverCode, status, expectedCode) => {
    stubFetch(async () => jsonResponse(errorEnvelope([{ code: serverCode, message: 'nope' }]), { status }));
    const client = buildClient();
    await expect(client.submitDocuments({ accessToken: 'token', idempotencyKey: 'key-1' })).rejects.toMatchObject({
      code: expectedCode,
    });
  });

  it('maps a 401 to SESSION_EXPIRED', async () => {
    stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'unauthorized', message: 'nope' }]), { status: 401 }));
    const client = buildClient();
    await expect(client.submitDocuments({ accessToken: 'token', idempotencyKey: 'key-1' })).rejects.toMatchObject({
      code: 'SESSION_EXPIRED',
    });
  });

  it('surfaces blocking_requirements from a documents_incomplete error', async () => {
    stubFetch(async () =>
      jsonResponse(
        errorEnvelope([
          {
            code: 'documents_incomplete',
            message: 'Upload all required documents before submitting.',
            details: { blocking_requirements: [{ requirement_code: 'passport', name: 'Passport', reason: 'missing' }] },
          },
        ]),
        { status: 422 }
      )
    );
    const client = buildClient();
    await expect(client.submitDocuments({ accessToken: 'token', idempotencyKey: 'key-1' })).rejects.toMatchObject({
      code: 'DOCUMENTS_INCOMPLETE',
      blockingRequirements: [{ requirementCode: 'passport', name: 'Passport', reason: 'missing' }],
    });
  });

  it('maps a 429 with a retry-after seconds value', async () => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: 'rate_limited', message: 'slow down' }]), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '30' },
      })
    );
    const client = buildClient();
    await expect(client.submitDocuments({ accessToken: 'token', idempotencyKey: 'key-1' })).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      retryAfterSeconds: 30,
    });
  });

  it('maps a 5xx to SERVER_ERROR', async () => {
    stubFetch(async () => new Response('', { status: 500 }));
    const client = buildClient();
    await expect(client.submitDocuments({ accessToken: 'token', idempotencyKey: 'key-1' })).rejects.toMatchObject({
      code: 'SERVER_ERROR',
    });
  });

  it('maps a network failure to NETWORK_ERROR', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });
    const client = buildClient();
    await expect(client.submitDocuments({ accessToken: 'token', idempotencyKey: 'key-1' })).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
  });
});

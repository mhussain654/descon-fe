// Runs under both web's Vitest and mobile's Jest (this module lives under
// shared/, which mobile's Jest config also roots into) even though the
// admin document-review workspace itself is web-only -- matches the
// established adminCandidateImport precedent.
import { createApiClient } from '../api-client';
import type { StaffAuthClient, StaffAuthError } from '../auth/staffTypes';
import { createAdminDocumentReviewsClient } from './realAdminDocumentReviewsClient';

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

function successEnvelope(data: unknown, meta: Record<string, unknown> = {}) {
  return { data, meta: { request_id: 'req-1', timestamp: '2026-08-26T09:00:00Z', ...meta }, errors: [] };
}

function errorEnvelope(errors: Array<{ code: string; message: string; field?: string }>) {
  return { errors, request_id: 'req-1' };
}

function fakeStaffAuthClient(onFailure?: StaffAuthError): StaffAuthClient {
  return {
    signIn: async () => {
      throw new Error('not used');
    },
    restoreSession: async () => null,
    signOut: async () => undefined,
    authenticatedRequest: async () => {
      throw new Error('not used');
    },
    authenticatedDataRequest: async (makeRequest) => {
      if (onFailure) throw onFailure;
      return makeRequest('staff-access-token');
    },
  };
}

function buildClient(locale: 'en' | 'ur' = 'en', onFailure?: StaffAuthError) {
  const apiClient = createApiClient({ baseUrl: 'http://example.test/api/v1' });
  const staffAuthClient = fakeStaffAuthClient(onFailure);
  return createAdminDocumentReviewsClient({ apiClient, staffAuthClient, getLocale: () => locale });
}

function referenceCode(overrides: Partial<{ code: string; name: string }> = {}) {
  return { code: 'PK', name: 'Pakistan', ...overrides };
}

function queueItemResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: 'submission-1',
    candidate: { id: 'candidate-1', full_name: 'Ahmed Ali' },
    assignment: {
      id: 'assignment-1',
      reference_number: 'REF-100',
      country: referenceCode({ code: 'SA', name: 'Saudi Arabia' }),
      project: referenceCode({ code: 'PRJ-1', name: 'Project One' }),
      craft: referenceCode({ code: 'welder', name: 'Welder' }),
    },
    submitted_at: '2026-08-20T10:00:00Z',
    review: { pending_review: 1, verified: 2, rejected: 0, required_total: 3, review_state: 'partially_reviewed' },
    ...overrides,
  };
}

function submissionDocumentResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: 'doc-1',
    requirement_code: 'passport',
    required: true,
    name: 'Passport',
    file_name: 'passport.pdf',
    content_type: 'application/pdf',
    file_size: 123456,
    uploaded_at: '2026-08-19T12:00:00Z',
    status: 'pending_review',
    ...overrides,
  };
}

describe('createAdminDocumentReviewsClient (real)', () => {
  describe('getQueue', () => {
    it('maps queue items and pagination from the response envelope', async () => {
      let capturedUrl: string | undefined;
      stubFetch(async (url) => {
        capturedUrl = String(url);
        return jsonResponse(
          successEnvelope([queueItemResponse()], {
            pagination: { page: 2, per_page: 20, total_count: 45, total_pages: 3 },
          })
        );
      });
      const client = buildClient();

      const result = await client.getQueue({ status: ['partially_reviewed'] }, { number: 2, size: 20 });

      expect(result.pagination).toEqual({ page: 2, perPage: 20, totalCount: 45, totalPages: 3 });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({
        id: 'submission-1',
        candidate: { id: 'candidate-1', fullName: 'Ahmed Ali' },
        assignment: {
          id: 'assignment-1',
          referenceNumber: 'REF-100',
          country: { code: 'SA', name: 'Saudi Arabia' },
          project: { code: 'PRJ-1', name: 'Project One' },
          craft: { code: 'welder', name: 'Welder' },
        },
        submittedAt: '2026-08-20T10:00:00Z',
        review: { pendingReview: 1, verified: 2, rejected: 0, requiredTotal: 3, reviewState: 'partially_reviewed' },
      });
      expect(capturedUrl).toContain('/admin/document_submissions?');
      expect(capturedUrl).toContain('filter%5Bstatus%5D=partially_reviewed');
      expect(capturedUrl).toContain('page%5Bnumber%5D=2');
    });

    it('maps the aggregate summary from meta.summary', async () => {
      stubFetch(async () =>
        jsonResponse(
          successEnvelope([queueItemResponse()], {
            pagination: { page: 1, per_page: 20, total_count: 1, total_pages: 1 },
            summary: { pending_review: 3, verified: 5, rejected: 2, expired_pcc: 1, near_expiry_pcc: 4 },
          })
        )
      );
      const client = buildClient();

      const result = await client.getQueue({}, {});

      expect(result.summary).toEqual({ pendingReview: 3, verified: 5, rejected: 2, expiredPcc: 1, nearExpiryPcc: 4 });
    });

    it('falls back to zero counts when meta.summary is missing or malformed', async () => {
      stubFetch(async () => jsonResponse(successEnvelope([queueItemResponse()])));
      const client = buildClient();

      const result = await client.getQueue({}, {});

      expect(result.summary).toEqual({ pendingReview: 0, verified: 0, rejected: 0, expiredPcc: 0, nearExpiryPcc: 0 });
    });

    it('sends the bearer token and X-Locale header', async () => {
      let capturedHeaders: Record<string, string> | undefined;
      stubFetch(async (_url, init) => {
        capturedHeaders = init?.headers as Record<string, string>;
        return jsonResponse(successEnvelope([]));
      });
      const client = buildClient('ur');

      await client.getQueue({}, {});

      expect(capturedHeaders?.Authorization).toBe('Bearer staff-access-token');
      expect(capturedHeaders?.['X-Locale']).toBe('ur');
    });

    it('falls back to an empty item list and safe pagination defaults for a malformed response', async () => {
      stubFetch(async () => jsonResponse(successEnvelope(null)));
      const client = buildClient();

      const result = await client.getQueue({}, {});

      expect(result.items).toEqual([]);
      expect(result.pagination).toEqual({ page: 1, perPage: 0, totalCount: 0, totalPages: 0 });
    });

    it('maps an unrecognized review_state to "unknown" rather than displaying the raw code', async () => {
      stubFetch(async () =>
        jsonResponse(successEnvelope([queueItemResponse({ review: { ...queueItemResponse().review, review_state: 'some_future_state' } })]))
      );
      const client = buildClient();

      const result = await client.getQueue({}, {});

      expect(result.items[0].review.reviewState).toBe('unknown');
    });

    it('never substitutes the raw code as the name for a missing/malformed country, project or craft', async () => {
      stubFetch(async () =>
        jsonResponse(
          successEnvelope([
            queueItemResponse({
              assignment: {
                ...queueItemResponse().assignment,
                country: { code: 'SA' },
                project: { code: 'PRJ-1', name: null },
                craft: {},
              },
            }),
          ])
        )
      );
      const client = buildClient();

      const result = await client.getQueue({}, {});

      const { country, project, craft } = result.items[0].assignment;
      expect(country).toEqual({ code: 'SA', name: '' });
      expect(project).toEqual({ code: 'PRJ-1', name: '' });
      expect(craft).toEqual({ code: '', name: '' });
    });
  });

  describe('getSubmission', () => {
    it('maps submission detail including documents', async () => {
      let capturedUrl: string | undefined;
      stubFetch(async (url) => {
        capturedUrl = String(url);
        return jsonResponse(
          successEnvelope({
            ...queueItemResponse(),
            documents: [
              submissionDocumentResponse(),
              submissionDocumentResponse({
                id: 'doc-2',
                status: 'rejected',
                verified_at: '2026-08-21T09:00:00Z',
                rejection_reason: 'Document is unreadable.',
                reviewer: { id: 'staff-public-id-1', role: 'admin' },
              }),
            ],
          })
        );
      });
      const client = buildClient();

      const detail = await client.getSubmission('submission-1');

      expect(capturedUrl).toContain('/admin/document_submissions/submission-1');
      expect(detail.documents).toHaveLength(2);
      expect(detail.documents[0]).toMatchObject({ id: 'doc-1', status: 'pending_review', requirementCode: 'passport' });
      expect(detail.documents[0].verifiedAt).toBeUndefined();
      expect(detail.documents[0].rejectionReason).toBeUndefined();
      expect(detail.documents[0].reviewer).toBeUndefined();
      expect(detail.documents[1]).toMatchObject({
        id: 'doc-2',
        status: 'rejected',
        verifiedAt: '2026-08-21T09:00:00Z',
        rejectionReason: 'Document is unreadable.',
        reviewer: { id: 'staff-public-id-1', role: 'admin' },
      });
    });

    it('maps an unrecognized reviewer role to "unknown" rather than displaying the raw code', async () => {
      stubFetch(async () =>
        jsonResponse(
          successEnvelope({
            ...queueItemResponse(),
            documents: [submissionDocumentResponse({ reviewer: { id: 'staff-1', role: 'superadmin' } })],
          })
        )
      );
      const client = buildClient();

      const detail = await client.getSubmission('submission-1');

      expect(detail.documents[0].reviewer).toEqual({ id: 'staff-1', role: 'unknown' });
    });

    it('never maps a reviewer email or name -- only id and role', async () => {
      stubFetch(async () =>
        jsonResponse(
          successEnvelope({
            ...queueItemResponse(),
            documents: [
              submissionDocumentResponse({
                reviewer: { id: 'staff-1', role: 'hr', email: 'reviewer@example.com', name: 'Should Not Appear' },
              }),
            ],
          })
        )
      );
      const client = buildClient();

      const detail = await client.getSubmission('submission-1');

      expect(detail.documents[0].reviewer).toEqual({ id: 'staff-1', role: 'hr' });
    });

    it('URL-encodes the submission id', async () => {
      let capturedUrl: string | undefined;
      stubFetch(async (url) => {
        capturedUrl = String(url);
        return jsonResponse(successEnvelope({ ...queueItemResponse(), documents: [] }));
      });
      const client = buildClient();

      await client.getSubmission('sub id/with-slash');

      expect(capturedUrl).toContain(encodeURIComponent('sub id/with-slash'));
    });

    it('drops a malformed document rather than crashing, and maps an unrecognized document status to "unknown"', async () => {
      stubFetch(async () =>
        jsonResponse(
          successEnvelope({
            ...queueItemResponse(),
            documents: [null, submissionDocumentResponse({ status: 'some_future_status' })],
          })
        )
      );
      const client = buildClient();

      const detail = await client.getSubmission('submission-1');

      expect(detail.documents).toHaveLength(1);
      expect(detail.documents[0].status).toBe('unknown');
    });
  });

  describe('requestDocumentAccess', () => {
    it('maps the access response and posts to the access endpoint', async () => {
      let capturedUrl: string | undefined;
      let capturedMethod: string | undefined;
      stubFetch(async (url, init) => {
        capturedUrl = String(url);
        capturedMethod = init?.method;
        return jsonResponse(
          successEnvelope({ document_id: 'doc-1', url: '/rails/active_storage/blobs/redirect/xyz/passport.pdf', expires_at: '2026-08-26T09:05:00Z' })
        );
      });
      const client = buildClient();

      const access = await client.requestDocumentAccess('doc-1');

      expect(capturedMethod).toBe('POST');
      expect(capturedUrl).toContain('/admin/candidate_documents/doc-1/access');
      expect(access).toEqual({
        documentId: 'doc-1',
        url: '/rails/active_storage/blobs/redirect/xyz/passport.pdf',
        expiresAt: '2026-08-26T09:05:00Z',
      });
    });
  });

  describe('verifyDocument', () => {
    it('sends the Idempotency-Key header and maps the decision result', async () => {
      let capturedHeaders: Record<string, string> | undefined;
      let capturedUrl: string | undefined;
      stubFetch(async (url, init) => {
        capturedUrl = String(url);
        capturedHeaders = init?.headers as Record<string, string>;
        return jsonResponse(
          successEnvelope({
            document: submissionDocumentResponse({ status: 'verified', verified_at: '2026-08-26T09:00:00Z', reviewer_id: 'staff-1' }),
            submission: { id: 'submission-1', review: { pending_review: 0, verified: 1, rejected: 0, required_total: 1, review_state: 'verified' } },
          })
        );
      });
      const client = buildClient();

      const result = await client.verifyDocument('doc-1', 'idem-key-1');

      expect(capturedUrl).toContain('/admin/candidate_documents/doc-1/verifications');
      expect(capturedHeaders?.['Idempotency-Key']).toBe('idem-key-1');
      expect(result.document.status).toBe('verified');
      expect(result.submission).toEqual({
        id: 'submission-1',
        review: { pendingReview: 0, verified: 1, rejected: 0, requiredTotal: 1, reviewState: 'verified' },
      });
    });

    it('sends no body when no dates are given', async () => {
      let capturedBody: unknown;
      stubFetch(async (_url, init) => {
        capturedBody = init?.body;
        return jsonResponse(
          successEnvelope({
            document: submissionDocumentResponse({ status: 'verified' }),
            submission: { id: 'submission-1', review: { pending_review: 0, verified: 1, rejected: 0, required_total: 1, review_state: 'verified' } },
          })
        );
      });
      const client = buildClient();

      await client.verifyDocument('doc-1', 'idem-key-1');

      expect(capturedBody).toBeUndefined();
    });

    it('sends HR-confirmed issued_on/expires_on in the documented body shape', async () => {
      let capturedBody: string | undefined;
      stubFetch(async (_url, init) => {
        capturedBody = init?.body as string;
        return jsonResponse(
          successEnvelope({
            document: submissionDocumentResponse({ status: 'verified', issued_on: '2020-01-01', expires_on: '2030-01-01' }),
            submission: { id: 'submission-1', review: { pending_review: 0, verified: 1, rejected: 0, required_total: 1, review_state: 'verified' } },
          })
        );
      });
      const client = buildClient();

      const result = await client.verifyDocument('doc-1', 'idem-key-1', { issuedOn: '2020-01-01', expiresOn: '2030-01-01' });

      expect(JSON.parse(capturedBody!)).toEqual({ issued_on: '2020-01-01', expires_on: '2030-01-01' });
      expect(result.document.issuedOn).toBe('2020-01-01');
      expect(result.document.expiresOn).toBe('2030-01-01');
    });
  });

  describe('rejectDocument', () => {
    it('sends the rejection reason in the documented body shape', async () => {
      let capturedBody: string | undefined;
      stubFetch(async (_url, init) => {
        capturedBody = init?.body as string;
        return jsonResponse(
          successEnvelope({
            document: submissionDocumentResponse({ status: 'rejected', rejection_reason: 'Document is unreadable.' }),
            submission: { id: 'submission-1', review: { pending_review: 0, verified: 0, rejected: 1, required_total: 1, review_state: 'changes_required' } },
          })
        );
      });
      const client = buildClient();

      await client.rejectDocument('doc-1', 'Document is unreadable.', 'idem-key-2');

      expect(JSON.parse(capturedBody!)).toEqual({ rejection: { reason: 'Document is unreadable.' } });
    });
  });

  describe('error mapping', () => {
    async function rejectionForServerCode(code: string, status: number, field?: string) {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code, message: 'server message', field }]), { status }));
      const client = buildClient();
      try {
        await client.getSubmission('submission-1');
        throw new Error('expected rejection');
      } catch (error) {
        return error;
      }
    }

    it.each([
      ['missing_idempotency_key', 400, 'MISSING_IDEMPOTENCY_KEY'],
      ['invalid_idempotency_key', 400, 'INVALID_IDEMPOTENCY_KEY'],
      ['review_not_allowed', 403, 'REVIEW_NOT_ALLOWED'],
      ['document_submission_not_found', 404, 'DOCUMENT_SUBMISSION_NOT_FOUND'],
      ['candidate_document_not_found', 404, 'CANDIDATE_DOCUMENT_NOT_FOUND'],
      ['document_access_forbidden', 403, 'DOCUMENT_ACCESS_FORBIDDEN'],
      ['document_attachment_missing', 422, 'DOCUMENT_ATTACHMENT_MISSING'],
      ['document_not_pending_review', 422, 'DOCUMENT_NOT_PENDING_REVIEW'],
      ['document_already_reviewed', 422, 'DOCUMENT_ALREADY_REVIEWED'],
      ['rejection_reason_required', 422, 'REJECTION_REASON_REQUIRED'],
      ['rejection_reason_invalid', 422, 'REJECTION_REASON_INVALID'],
      ['idempotency_conflict', 409, 'IDEMPOTENCY_CONFLICT'],
      ['idempotency_in_progress', 409, 'IDEMPOTENCY_IN_PROGRESS'],
      ['inactive_account', 403, 'INACTIVE_ACCOUNT'],
    ])('maps server code %s (%i) to %s', async (code, status, expectedCode) => {
      const error = await rejectionForServerCode(code as string, status as number);
      expect(error).toMatchObject({ code: expectedCode, message: 'server message' });
    });

    it('maps a 401 (surfaced as StaffAuthError SESSION_EXPIRED by authenticatedDataRequest) to SESSION_EXPIRED', async () => {
      const client = buildClient('en', { code: 'SESSION_EXPIRED' });
      await expect(client.getSubmission('submission-1')).rejects.toEqual({ code: 'SESSION_EXPIRED' });
    });

    it('maps a StaffAuthError NETWORK_ERROR through unchanged', async () => {
      const client = buildClient('en', { code: 'NETWORK_ERROR' });
      await expect(client.getSubmission('submission-1')).rejects.toEqual({ code: 'NETWORK_ERROR' });
    });

    it('maps a StaffAuthError OFFLINE through unchanged', async () => {
      const client = buildClient('en', { code: 'OFFLINE' });
      await expect(client.getSubmission('submission-1')).rejects.toEqual({ code: 'OFFLINE' });
    });

    it('maps any other StaffAuthError to UNKNOWN', async () => {
      const client = buildClient('en', { code: 'FORBIDDEN' });
      await expect(client.getSubmission('submission-1')).rejects.toEqual({ code: 'UNKNOWN' });
    });

    it('maps a 403 without a recognized serverCode to FORBIDDEN', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'some_unrecognized_403', message: 'nope' }]), { status: 403 }));
      const client = buildClient();
      await expect(client.getSubmission('submission-1')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('maps invalid_query_parameter to VALIDATION_ERROR', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'invalid_query_parameter', message: 'bad filter', field: 'filter.status' }]), { status: 400 }));
      const client = buildClient();
      await expect(client.getQueue({}, {})).rejects.toMatchObject({ code: 'VALIDATION_ERROR', field: 'filter.status' });
    });

    it('maps a 429 to RATE_LIMITED with retryAfterSeconds', async () => {
      stubFetch(async () =>
        jsonResponse(errorEnvelope([{ code: 'rate_limited', message: 'slow down' }]), {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '15' },
        })
      );
      const client = buildClient();
      await expect(client.getSubmission('submission-1')).rejects.toEqual({ code: 'RATE_LIMITED', retryAfterSeconds: 15 });
    });

    it('maps a 5xx to SERVER_ERROR without inventing an English message', async () => {
      stubFetch(async () => new Response('Internal Server Error', { status: 500 }));
      const client = buildClient();
      await expect(client.getSubmission('submission-1')).rejects.toEqual({ code: 'SERVER_ERROR' });
    });

    it('maps a network failure to NETWORK_ERROR when online', async () => {
      stubFetch(async () => {
        throw new TypeError('Failed to fetch');
      });
      const apiClient = createApiClient({ baseUrl: 'http://example.test', isOnline: () => true });
      const client = createAdminDocumentReviewsClient({
        apiClient,
        staffAuthClient: fakeStaffAuthClient(),
        getLocale: () => 'en',
      });
      await expect(client.getSubmission('submission-1')).rejects.toEqual({ code: 'NETWORK_ERROR' });
    });

    it('maps offline to OFFLINE', async () => {
      stubFetch(async () => {
        throw new TypeError('Failed to fetch');
      });
      const apiClient = createApiClient({ baseUrl: 'http://example.test', isOnline: () => false });
      const client = createAdminDocumentReviewsClient({
        apiClient,
        staffAuthClient: fakeStaffAuthClient(),
        getLocale: () => 'en',
      });
      await expect(client.getSubmission('submission-1')).rejects.toEqual({ code: 'OFFLINE' });
    });
  });

  describe('getExtraction', () => {
    it('maps a succeeded extraction', async () => {
      let capturedUrl: string | undefined;
      stubFetch(async (url) => {
        capturedUrl = String(url);
        return jsonResponse(
          successEnvelope({
            status: 'succeeded',
            issued_on: '2020-01-01',
            expires_on: '2030-01-01',
            confidence_issued_on: 96.4,
            confidence_expires_on: 95.1,
            extracted_at: '2026-08-27T10:00:00Z',
          })
        );
      });
      const client = buildClient();

      const result = await client.getExtraction('doc-1');

      expect(capturedUrl).toContain('/admin/candidate_documents/doc-1/extraction');
      expect(result).toEqual({
        status: 'succeeded',
        issuedOn: '2020-01-01',
        expiresOn: '2030-01-01',
        confidenceIssuedOn: 96.4,
        confidenceExpiresOn: 95.1,
        extractedAt: '2026-08-27T10:00:00Z',
      });
    });

    it('maps not_started with no other fields present', async () => {
      stubFetch(async () => jsonResponse(successEnvelope({ status: 'not_started' })));
      const client = buildClient();

      const result = await client.getExtraction('doc-1');

      expect(result).toEqual({ status: 'not_started' });
    });

    it('maps a failed extraction, including its error message', async () => {
      stubFetch(async () =>
        jsonResponse(successEnvelope({ status: 'failed', error_message: 'no identity document detected' }))
      );
      const client = buildClient();

      const result = await client.getExtraction('doc-1');

      expect(result).toEqual({ status: 'failed', errorMessage: 'no identity document detected' });
    });
  });
});

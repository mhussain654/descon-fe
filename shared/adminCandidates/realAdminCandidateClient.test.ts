// Runs under both web's Vitest and mobile's Jest (this module lives under
// shared/), matching the established adminWorkflow precedent -- even though
// the admin candidate feature itself is web-only.
import { createApiClient } from '../api-client';
import type { StaffAuthClient, StaffAuthError } from '../auth/staffTypes';
import { createAdminCandidateClient } from './realAdminCandidateClient';

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
  return { data, meta: { request_id: 'req-1', timestamp: '2026-08-30T09:00:00Z', ...meta }, errors: [] };
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
  return createAdminCandidateClient({ apiClient, staffAuthClient, getLocale: () => locale });
}

function candidateDetailResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: 'candidate-1',
    full_name: 'Jane Applicant',
    cnic: '42101-1234567-1',
    mobile_number: '+923001234567',
    passport_number: null,
    preferred_locale: 'en',
    candidate_status: 'documents_pending',
    active: true,
    created_at: '2026-08-30T09:00:00Z',
    updated_at: '2026-08-30T09:00:00Z',
    assignment: {
      id: 'assignment-1',
      reference_number: 'DES-000123',
      country: { code: 'qatar', name: 'Qatar' },
      project: { code: 'qatar_infrastructure', name: 'Qatar Infrastructure' },
      craft: { code: 'electrician', name: 'Electrician' },
      current_workflow_stage: { code: 'documents_pending', name: 'Documents Pending' },
      created_at: '2026-08-30T09:00:00Z',
    },
    ...overrides,
  };
}

describe('createAdminCandidateClient (real)', () => {
  describe('getCandidate', () => {
    it('maps the full candidate detail, including its assignment', async () => {
      let capturedUrl: string | undefined;
      let capturedHeaders: Record<string, string> | undefined;
      stubFetch(async (url, init) => {
        capturedUrl = String(url);
        capturedHeaders = init?.headers as Record<string, string>;
        return jsonResponse(successEnvelope(candidateDetailResponse()));
      });
      const client = buildClient('ur');

      const result = await client.getCandidate('candidate-1');

      expect(capturedUrl).toContain('/admin/candidates/candidate-1');
      expect(capturedHeaders?.['X-Locale']).toBe('ur');
      expect(result).toEqual({
        id: 'candidate-1',
        fullName: 'Jane Applicant',
        cnic: '42101-1234567-1',
        mobileNumber: '+923001234567',
        passportNumber: null,
        preferredLocale: 'en',
        candidateStatus: 'documents_pending',
        active: true,
        createdAt: '2026-08-30T09:00:00Z',
        updatedAt: '2026-08-30T09:00:00Z',
        assignment: {
          id: 'assignment-1',
          referenceNumber: 'DES-000123',
          country: { code: 'qatar', name: 'Qatar' },
          project: { code: 'qatar_infrastructure', name: 'Qatar Infrastructure' },
          craft: { code: 'electrician', name: 'Electrician' },
          currentWorkflowStage: { code: 'documents_pending', name: 'Documents Pending' },
          createdAt: '2026-08-30T09:00:00Z',
        },
      });
    });

    it('maps a null assignment to null, never a fabricated placeholder', async () => {
      stubFetch(async () => jsonResponse(successEnvelope(candidateDetailResponse({ assignment: null }))));
      const client = buildClient();

      const result = await client.getCandidate('candidate-1');

      expect(result.assignment).toBeNull();
    });

    it('maps a 404 to NOT_FOUND', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'not_found', message: 'Record not found.' }]), { status: 404 }));
      const client = buildClient();

      await expect(client.getCandidate('unknown')).rejects.toEqual({ code: 'NOT_FOUND', message: 'Record not found.', field: undefined });
    });
  });

  describe('createCandidate', () => {
    it('sends the documented request body and Idempotency-Key header, omitting passport_number when not given', async () => {
      let capturedUrl: string | undefined;
      let capturedBody: string | undefined;
      let capturedHeaders: Record<string, string> | undefined;
      stubFetch(async (url, init) => {
        capturedUrl = String(url);
        capturedBody = init?.body as string;
        capturedHeaders = init?.headers as Record<string, string>;
        return jsonResponse(successEnvelope(candidateDetailResponse()), { status: 201 });
      });
      const client = buildClient();

      await client.createCandidate({
        fullName: 'Jane Applicant',
        cnic: '42101-1234567-1',
        mobileNumber: '+923001234567',
        preferredLocale: 'en',
        countryCode: 'qatar',
        projectCode: 'qatar_infrastructure',
        craftCode: 'electrician',
        referenceNumber: 'DES-000123',
        idempotencyKey: 'idem-create-1',
      });

      expect(capturedUrl).toContain('/admin/candidates');
      expect(capturedHeaders?.['Idempotency-Key']).toBe('idem-create-1');
      const body = JSON.parse(capturedBody!);
      expect(body).toEqual({
        candidate: {
          full_name: 'Jane Applicant',
          cnic: '42101-1234567-1',
          mobile_number: '+923001234567',
          preferred_locale: 'en',
          country_code: 'qatar',
          project_code: 'qatar_infrastructure',
          craft_code: 'electrician',
          reference_number: 'DES-000123',
        },
      });
      expect(body.candidate).not.toHaveProperty('passport_number');
    });

    it('includes passport_number when given', async () => {
      let capturedBody: string | undefined;
      stubFetch(async (_url, init) => {
        capturedBody = init?.body as string;
        return jsonResponse(successEnvelope(candidateDetailResponse()), { status: 201 });
      });
      const client = buildClient();

      await client.createCandidate({
        fullName: 'Jane Applicant',
        cnic: '42101-1234567-1',
        mobileNumber: '+923001234567',
        passportNumber: 'AB123456',
        preferredLocale: 'en',
        countryCode: 'qatar',
        projectCode: 'qatar_infrastructure',
        craftCode: 'electrician',
        referenceNumber: 'DES-000123',
        idempotencyKey: 'idem-create-2',
      });

      expect(JSON.parse(capturedBody!).candidate.passport_number).toBe('AB123456');
    });

    it('maps a duplicate CNIC error with its field', async () => {
      stubFetch(async () =>
        jsonResponse(errorEnvelope([{ code: 'duplicate_cnic', message: 'A candidate with this CNIC already exists.', field: 'cnic' }]), {
          status: 422,
        })
      );
      const client = buildClient();

      await expect(
        client.createCandidate({
          fullName: 'Jane Applicant',
          cnic: '42101-1234567-1',
          mobileNumber: '+923001234567',
          preferredLocale: 'en',
          countryCode: 'qatar',
          projectCode: 'qatar_infrastructure',
          craftCode: 'electrician',
          referenceNumber: 'DES-000123',
          idempotencyKey: 'idem-create-3',
        })
      ).rejects.toEqual({ code: 'DUPLICATE_CNIC', message: 'A candidate with this CNIC already exists.', field: 'cnic' });
    });
  });

  describe('updateCandidate', () => {
    it('sends only the provided fields, never defaulting an omitted one to null', async () => {
      let capturedBody: string | undefined;
      let capturedMethod: string | undefined;
      stubFetch(async (_url, init) => {
        capturedMethod = init?.method;
        capturedBody = init?.body as string;
        return jsonResponse(successEnvelope(candidateDetailResponse({ full_name: 'Updated Name' })));
      });
      const client = buildClient();

      await client.updateCandidate({ candidateId: 'candidate-1', fullName: 'Updated Name' });

      expect(capturedMethod).toBe('PATCH');
      expect(JSON.parse(capturedBody!)).toEqual({ candidate: { full_name: 'Updated Name' } });
    });

    it('sends an explicit empty string to clear the passport number', async () => {
      let capturedBody: string | undefined;
      stubFetch(async (_url, init) => {
        capturedBody = init?.body as string;
        return jsonResponse(successEnvelope(candidateDetailResponse({ passport_number: null })));
      });
      const client = buildClient();

      await client.updateCandidate({ candidateId: 'candidate-1', passportNumber: '' });

      expect(JSON.parse(capturedBody!).candidate.passport_number).toBe('');
    });

    it('maps a stale conflict (409) to STALE_CANDIDATE', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'stale_candidate', message: 'stale' }]), { status: 409 }));
      const client = buildClient();

      await expect(client.updateCandidate({ candidateId: 'candidate-1', fullName: 'X' })).rejects.toEqual({
        code: 'STALE_CANDIDATE',
        message: 'stale',
        field: undefined,
      });
    });

    it('maps an assignment-field-locked error with its field', async () => {
      stubFetch(async () =>
        jsonResponse(
          errorEnvelope([
            {
              code: 'candidate_assignment_field_locked',
              message: 'This field can only be changed while the candidate is still at the registered stage.',
              field: 'craft_code',
            },
          ]),
          { status: 422 }
        )
      );
      const client = buildClient();

      await expect(client.updateCandidate({ candidateId: 'candidate-1', craftCode: 'welder' })).rejects.toEqual({
        code: 'ASSIGNMENT_FIELD_LOCKED',
        message: 'This field can only be changed while the candidate is still at the registered stage.',
        field: 'craft_code',
      });
    });
  });

  describe('reference data', () => {
    it('getCountries maps the active list', async () => {
      let capturedUrl: string | undefined;
      stubFetch(async (url) => {
        capturedUrl = String(url);
        return jsonResponse(successEnvelope([{ code: 'qatar', name: 'Qatar' }]));
      });
      const client = buildClient();

      const result = await client.getCountries();

      expect(capturedUrl).toContain('/admin/countries');
      expect(result).toEqual([{ code: 'qatar', name: 'Qatar' }]);
    });

    it('getProjects maps the active list', async () => {
      stubFetch(async () => jsonResponse(successEnvelope([{ code: 'qatar_infrastructure', name: 'Qatar Infrastructure' }])));
      const client = buildClient();

      expect(await client.getProjects()).toEqual([{ code: 'qatar_infrastructure', name: 'Qatar Infrastructure' }]);
    });

    it('getCrafts maps the active list', async () => {
      stubFetch(async () => jsonResponse(successEnvelope([{ code: 'electrician', name: 'Electrician' }])));
      const client = buildClient();

      expect(await client.getCrafts()).toEqual([{ code: 'electrician', name: 'Electrician' }]);
    });

    it('falls back to an empty list for a malformed response', async () => {
      stubFetch(async () => jsonResponse(successEnvelope(null)));
      const client = buildClient();

      expect(await client.getCountries()).toEqual([]);
    });
  });

  describe('error mapping', () => {
    it('maps FORBIDDEN, RATE_LIMITED and SERVER_ERROR from their status codes', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'forbidden', message: 'nope' }]), { status: 403 }));
      await expect(buildClient().getCandidate('candidate-1')).rejects.toMatchObject({ code: 'FORBIDDEN' });

      stubFetch(async () => jsonResponse({}, { status: 429, headers: { 'Retry-After': '30' } }));
      await expect(buildClient().getCandidate('candidate-1')).rejects.toMatchObject({ code: 'RATE_LIMITED', retryAfterSeconds: 30 });

      stubFetch(async () => jsonResponse({}, { status: 500 }));
      await expect(buildClient().getCandidate('candidate-1')).rejects.toMatchObject({ code: 'SERVER_ERROR' });
    });

    it('maps a staff-auth SESSION_EXPIRED/OFFLINE error without a status', async () => {
      const client = buildClient('en', { code: 'SESSION_EXPIRED' });
      await expect(client.getCandidate('candidate-1')).rejects.toEqual({ code: 'SESSION_EXPIRED' });

      const offlineClient = buildClient('en', { code: 'OFFLINE' });
      await expect(offlineClient.getCandidate('candidate-1')).rejects.toEqual({ code: 'OFFLINE' });
    });
  });
});

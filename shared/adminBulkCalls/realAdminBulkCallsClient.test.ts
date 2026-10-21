import { createApiClient } from '../api-client';
import type { StaffAuthClient } from '../auth/staffTypes';
import { createAdminBulkCallsClient } from './realAdminBulkCallsClient';

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

function successEnvelope(data: unknown, meta: Record<string, unknown> = {}) {
  return { data, meta: { request_id: 'req-1', timestamp: '2026-10-18T09:00:00Z', ...meta }, errors: [] };
}

function errorEnvelope(errors: Array<{ code: string; message: string; field?: string }>) {
  return { errors, request_id: 'req-1' };
}

function voicePayload(overrides: Record<string, unknown> = {}) {
  return { id: 'voice-1', name_en: 'Visa approved', name_ur: null, voice_id: '205', active: true, updated_at: '2026-10-18T09:00:00Z', ...overrides };
}

function batchPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 'batch-1',
    voice: { id: 'voice-1', name: 'Visa approved' },
    workflow_stage_code: 'verified',
    filters: {},
    requested_limit: 200,
    selected_count: 2,
    counts: { queued: 2 },
    created_by: { id: 'staff-1', role: 'admin' },
    created_at: '2026-10-18T09:00:00Z',
    ...overrides,
  };
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
  return createAdminBulkCallsClient({ apiClient, staffAuthClient: fakeStaffAuthClient(), getLocale: () => locale });
}

describe('createAdminBulkCallsClient (real)', () => {
  describe('voices', () => {
    it('lists call types with auth and locale headers', async () => {
      let seenUrl = '';
      let seenInit: RequestInit | undefined;
      stubFetch(async (url, init) => {
        seenUrl = String(url);
        seenInit = init as RequestInit;
        return jsonResponse(successEnvelope([voicePayload({ name_ur: 'ویزا منظور' })]));
      });

      const voices = await buildClient('ur').listVoices();

      expect(seenUrl).toBe('http://example.test/api/v1/admin/robocall_voices');
      expect((seenInit?.headers as Record<string, string>)['Authorization']).toBe('Bearer staff-access-token');
      expect((seenInit?.headers as Record<string, string>)['X-Locale']).toBe('ur');
      expect(voices).toEqual([
        { id: 'voice-1', nameEn: 'Visa approved', nameUr: 'ویزا منظور', voiceId: '205', active: true, updatedAt: '2026-10-18T09:00:00Z' },
      ]);
    });

    it('maps a missing Urdu name to undefined and a non-array response to an empty list', async () => {
      stubFetch(async () => jsonResponse(successEnvelope([voicePayload()])));
      expect((await buildClient().listVoices())[0].nameUr).toBeUndefined();

      stubFetch(async () => jsonResponse(successEnvelope(null)));
      expect(await buildClient().listVoices()).toEqual([]);
    });

    it('creates a call type, sending a blank Urdu name as null', async () => {
      let body = '';
      stubFetch(async (_url, init) => {
        body = String((init as RequestInit).body);
        return jsonResponse(successEnvelope(voicePayload()), { status: 201 });
      });

      const voice = await buildClient().createVoice({ nameEn: 'Visa approved', nameUr: '  ', voiceId: '205', active: true });

      expect(JSON.parse(body)).toEqual({ robocall_voice: { name_en: 'Visa approved', name_ur: null, voice_id: '205', active: true } });
      expect(voice.voiceId).toBe('205');
    });

    it('updates only the fields given', async () => {
      let seenUrl = '';
      let seenMethod = '';
      let body = '';
      stubFetch(async (url, init) => {
        seenUrl = String(url);
        seenMethod = String((init as RequestInit).method);
        body = String((init as RequestInit).body);
        return jsonResponse(successEnvelope(voicePayload({ active: false })));
      });

      const voice = await buildClient().updateVoice('voice-1', { active: false });

      expect(seenUrl).toBe('http://example.test/api/v1/admin/robocall_voices/voice-1');
      expect(seenMethod).toBe('PATCH');
      expect(JSON.parse(body)).toEqual({ robocall_voice: { active: false } });
      expect(voice.active).toBe(false);
    });

    it('sends every editable field when all are given', async () => {
      let body = '';
      stubFetch(async (_url, init) => {
        body = String((init as RequestInit).body);
        return jsonResponse(successEnvelope(voicePayload()));
      });

      await buildClient().updateVoice('voice-1', { nameEn: 'Flight', nameUr: 'پرواز', voiceId: '300', active: true });

      expect(JSON.parse(body)).toEqual({ robocall_voice: { name_en: 'Flight', name_ur: 'پرواز', voice_id: '300', active: true } });
    });
  });

  describe('listCandidates', () => {
    const query = { voiceId: 'voice-1', stageCode: 'verified', called: 'not_called', page: 2, pageSize: 25 } as const;

    it('builds the query string and maps rows, summary, pagination and the batch limit', async () => {
      let seenUrl = '';
      stubFetch(async (url) => {
        seenUrl = String(url);
        return jsonResponse(
          successEnvelope(
            [
              { id: 'c1', full_name: 'Ahmed Khan', reference_number: 'DES-1', mobile_number_masked: '+92300*****12', call_state: 'not_called', last_call: null },
              {
                id: 'c2',
                full_name: 'Bilal',
                reference_number: null,
                mobile_number_masked: '+92301*****34',
                call_state: 'called',
                last_call: { status: 'completed', outcome: 'answered', outcome_reason: 'resolved', called_at: '2026-10-18T08:00:00Z' },
              },
            ],
            {
              summary: { matching: 340, called: 140, remaining: 200 },
              batch_limit: 200,
              pagination: { page: 2, per_page: 25, total_count: 200, total_pages: 8 },
            }
          )
        );
      });

      const result = await buildClient().listCandidates({ ...query, countryCode: 'qatar', projectCode: 'p1', craftCode: 'welder', search: 'khan' });

      const params = new URL(seenUrl).searchParams;
      expect(new URL(seenUrl).pathname).toBe('/api/v1/admin/bulk_calls/candidates');
      expect(Object.fromEntries(params)).toEqual({
        robocall_voice_id: 'voice-1',
        'filter[status]': 'verified',
        'filter[country_code]': 'qatar',
        'filter[project_code]': 'p1',
        'filter[craft_code]': 'welder',
        search: 'khan',
        called: 'not_called',
        'page[number]': '2',
        'page[size]': '25',
      });
      expect(result.summary).toEqual({ matching: 340, called: 140, remaining: 200 });
      expect(result.batchLimit).toBe(200);
      expect(result.pagination).toEqual({ page: 2, perPage: 25, totalCount: 200, totalPages: 8 });
      expect(result.candidates[0]).toEqual({
        id: 'c1',
        fullName: 'Ahmed Khan',
        referenceNumber: 'DES-1',
        mobileNumberMasked: '+92300*****12',
        callState: 'not_called',
        lastCall: undefined,
      });
      expect(result.candidates[1].lastCall).toEqual({ status: 'completed', outcome: 'answered', outcomeReason: 'resolved', calledAt: '2026-10-18T08:00:00Z' });
      expect(result.candidates[1].referenceNumber).toBeUndefined();
    });

    it('omits the optional filters and falls back to zeros when the meta is missing', async () => {
      let seenUrl = '';
      stubFetch(async (url) => {
        seenUrl = String(url);
        return jsonResponse({ data: [], meta: {}, errors: [] });
      });

      const result = await buildClient().listCandidates(query);

      expect([...new URL(seenUrl).searchParams.keys()]).toEqual(['robocall_voice_id', 'filter[status]', 'called', 'page[number]', 'page[size]']);
      expect(result).toEqual({
        candidates: [],
        pagination: { page: 1, perPage: 0, totalCount: 0, totalPages: 0 },
        summary: { matching: 0, called: 0, remaining: 0 },
        batchLimit: 0,
      });
    });
  });

  describe('startBatch', () => {
    const input = { voiceId: 'voice-1', stageCode: 'verified', limit: 200, idempotencyKey: 'key-1' };

    it('sends the selection with the Idempotency-Key and maps the batch', async () => {
      let seenHeaders: Record<string, string> = {};
      let body = '';
      stubFetch(async (_url, init) => {
        seenHeaders = (init as RequestInit).headers as Record<string, string>;
        body = String((init as RequestInit).body);
        return jsonResponse(successEnvelope(batchPayload()), { status: 201 });
      });

      const batch = await buildClient().startBatch(input);

      expect(seenHeaders['Idempotency-Key']).toBe('key-1');
      expect(JSON.parse(body)).toEqual({ bulk_call: { robocall_voice_id: 'voice-1', workflow_stage_code: 'verified', limit: 200 } });
      expect(batch).toMatchObject({
        id: 'batch-1',
        voice: { id: 'voice-1', name: 'Visa approved' },
        workflowStageCode: 'verified',
        selectedCount: 2,
        counts: { queued: 2, placed: 0, skipped: 0, failed: 0 },
        createdBy: { id: 'staff-1', role: 'admin' },
      });
      expect(batch.items).toBeUndefined();
    });

    it('sends the narrowing filters and search when set', async () => {
      let body = '';
      stubFetch(async (_url, init) => {
        body = String((init as RequestInit).body);
        return jsonResponse(successEnvelope(batchPayload()), { status: 201 });
      });

      await buildClient().startBatch({ ...input, countryCode: 'qatar', craftCode: 'welder', search: 'khan' });

      expect(JSON.parse(body).bulk_call).toEqual({
        robocall_voice_id: 'voice-1',
        workflow_stage_code: 'verified',
        limit: 200,
        search: 'khan',
        filter: { country_code: 'qatar', craft_code: 'welder' },
      });
    });

    it.each([
      ['ai_call_bulk_nothing_to_call', 422, 'NOTHING_TO_CALL'],
      ['ai_call_outside_calling_hours', 422, 'OUTSIDE_CALLING_HOURS'],
      ['ai_call_daily_limit_reached', 429, 'DAILY_LIMIT_REACHED'],
      ['ai_call_outbound_disabled', 503, 'CALLING_DISABLED'],
      ['ai_call_voice_not_configured', 422, 'CALLING_DISABLED'],
      ['idempotency_conflict', 409, 'IDEMPOTENCY_CONFLICT'],
      ['missing_idempotency_key', 400, 'MISSING_IDEMPOTENCY_KEY'],
      ['validation_failed', 422, 'VALIDATION_FAILED'],
      ['inactive_account', 403, 'INACTIVE_ACCOUNT'],
    ])('maps the server code %s to %s, keeping the localized message', async (serverCode, status, expected) => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: serverCode, message: 'server message' }]), { status }));

      await expect(buildClient().startBatch(input)).rejects.toMatchObject({ code: expected, message: 'server message' });
    });
  });

  describe('batches', () => {
    it('lists recent batches, zero-filling counts', async () => {
      stubFetch(async () => jsonResponse(successEnvelope([batchPayload({ filters: null, counts: {} })])));

      const batches = await buildClient().listBatches();

      expect(batches).toHaveLength(1);
      expect(batches[0].counts).toEqual({ queued: 0, placed: 0, skipped: 0, failed: 0 });
      expect(batches[0].filters).toEqual({});
    });

    it('returns an empty list for a non-array response', async () => {
      stubFetch(async () => jsonResponse(successEnvelope(null)));

      expect(await buildClient().listBatches()).toEqual([]);
    });

    it('gets one batch with each candidate\'s result and call', async () => {
      let seenUrl = '';
      stubFetch(async (url) => {
        seenUrl = String(url);
        return jsonResponse(
          successEnvelope(
            batchPayload({
              counts: { placed: 1, skipped: 1 },
              items: [
                {
                  id: 11,
                  candidate: { id: 'c1', full_name: 'Ahmed Khan', mobile_number_masked: '+92300*****12' },
                  status: 'placed',
                  skip_reason: null,
                  call: { id: 'call-1', status: 'completed', outcome: 'callback_required', outcome_reason: 'candidate_requested', callback_requested_at: '2026-10-18T09:05:00Z' },
                },
                {
                  id: 12,
                  candidate: { id: 'c2', full_name: 'Bilal', mobile_number_masked: '+92301*****34' },
                  status: 'skipped',
                  skip_reason: 'stage_changed',
                  call: null,
                },
              ],
            })
          )
        );
      });

      const batch = await buildClient().getBatch('batch-1');

      expect(seenUrl).toBe('http://example.test/api/v1/admin/bulk_calls/batch-1');
      expect(batch.items).toEqual([
        {
          id: 11,
          candidate: { id: 'c1', fullName: 'Ahmed Khan', mobileNumberMasked: '+92300*****12' },
          status: 'placed',
          skipReason: undefined,
          call: { id: 'call-1', status: 'completed', outcome: 'callback_required', outcomeReason: 'candidate_requested', callbackRequestedAt: '2026-10-18T09:05:00Z' },
        },
        {
          id: 12,
          candidate: { id: 'c2', fullName: 'Bilal', mobileNumberMasked: '+92301*****34' },
          status: 'skipped',
          skipReason: 'stage_changed',
          call: undefined,
        },
      ]);
    });

    it('maps a call without optional fields', async () => {
      stubFetch(async () =>
        jsonResponse(
          successEnvelope(
            batchPayload({
              items: [
                {
                  id: 13,
                  candidate: { id: 'c3', full_name: 'Sana', mobile_number_masked: '+92302*****56' },
                  status: 'placed',
                  skip_reason: null,
                  call: { id: 'call-2', status: 'queued', outcome: null, outcome_reason: null, callback_requested_at: null },
                },
              ],
            })
          )
        )
      );

      const item = (await buildClient().getBatch('batch-1')).items![0];

      expect(item.call).toEqual({ id: 'call-2', status: 'queued', outcome: undefined, outcomeReason: undefined, callbackRequestedAt: undefined });
    });
  });

  describe('error mapping', () => {
    it.each([
      [403, 'FORBIDDEN'],
      [404, 'NOT_FOUND'],
      [409, 'IDEMPOTENCY_CONFLICT'],
      [422, 'VALIDATION_FAILED'],
      [429, 'RATE_LIMITED'],
      [500, 'SERVER_ERROR'],
      [418, 'UNKNOWN'],
    ])('maps an unrecognised-code HTTP %i response to %s', async (status, expected) => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'something_else', message: 'm' }]), { status }));

      await expect(buildClient().listBatches()).rejects.toMatchObject({ code: expected });
    });

    it('maps a network failure and an offline browser', async () => {
      stubFetch(async () => {
        throw new TypeError('Failed to fetch');
      });

      await expect(buildClient().listBatches()).rejects.toMatchObject({ code: expect.stringMatching(/NETWORK_ERROR|OFFLINE/) });
    });

    it('maps an unexpected thrown value to UNKNOWN', async () => {
      const client = createAdminBulkCallsClient({
        apiClient: createApiClient({ baseUrl: 'http://example.test/api/v1' }),
        staffAuthClient: { ...fakeStaffAuthClient(), authenticatedDataRequest: async () => Promise.reject('boom') },
        getLocale: () => 'en',
      });

      await expect(client.listBatches()).rejects.toEqual({ code: 'UNKNOWN' });
    });

    it('maps a staff-auth session expiry', async () => {
      const client = createAdminBulkCallsClient({
        apiClient: createApiClient({ baseUrl: 'http://example.test/api/v1' }),
        staffAuthClient: { ...fakeStaffAuthClient(), authenticatedDataRequest: async () => Promise.reject({ code: 'SESSION_EXPIRED' }) },
        getLocale: () => 'en',
      });

      await expect(client.listVoices()).rejects.toEqual({ code: 'SESSION_EXPIRED' });
    });

    it('treats a missing body on a create as UNKNOWN', async () => {
      stubFetch(async () => new Response(null, { status: 204 }));

      await expect(buildClient().createVoice({ nameEn: 'x', nameUr: '', voiceId: '1', active: true })).rejects.toEqual({ code: 'UNKNOWN' });
    });
  });
});

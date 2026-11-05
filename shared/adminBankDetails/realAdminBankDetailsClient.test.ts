import { createApiClient } from '../api-client';
import type { StaffAuthClient } from '../auth/staffTypes';
import { createAdminBankDetailsClient } from './realAdminBankDetailsClient';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const envelope = (data: unknown) => ({ data, meta: { request_id: 'req-1', timestamp: '2026-11-05T09:00:00Z' }, errors: [] });

function client() {
  const staffAuthClient = {
    signIn: async () => {
      throw new Error('not used');
    },
    restoreSession: async () => null,
    signOut: async () => undefined,
    authenticatedRequest: async () => {
      throw new Error('not used');
    },
    authenticatedDataRequest: async (makeRequest) => makeRequest('staff-token'),
  } as StaffAuthClient;
  return createAdminBankDetailsClient({ apiClient: createApiClient({ baseUrl: 'http://example.test/api/v1' }), staffAuthClient, getLocale: () => 'en' });
}

const payload = {
  id: 'bank-1', status: 'rejected', account_title: 'Ahmed Ali', account_number: 'PK36SCBL0000001123456702', bank_name: 'Meezan Bank',
  proof: { file_name: 'cheque.pdf', content_type: 'application/pdf', file_size: 2048 }, submitted_at: '2026-11-05T07:00:00Z',
  rejection_reason: 'The IBAN does not match the cheque.', reviewed_at: '2026-11-05T08:00:00Z', reviewed_by: { id: 'u-1', role: 'finance' },
};

describe('createAdminBankDetailsClient (real)', () => {
  it('returns null when the candidate has no bank details', async () => {
    globalThis.fetch = (async () =>
      json({ errors: [{ code: 'candidate_bank_detail_not_found', message: 'Candidate bank details not found.' }] }, 404)) as typeof fetch;

    await expect(client().get('candidate-1')).resolves.toBeNull();
  });

  it('sends a rejection with its reason and Idempotency-Key, and maps the result', async () => {
    let seenUrl = '';
    let seenInit: RequestInit = {};
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      seenUrl = String(url);
      seenInit = init;
      return json(envelope(payload), 201);
    }) as typeof fetch;

    const result = await client().reject('candidate-1', 'The IBAN does not match the cheque.', 'key-1');

    expect(seenUrl).toBe('http://example.test/api/v1/admin/candidates/candidate-1/bank_details/rejection');
    expect(JSON.parse(String(seenInit.body))).toEqual({ rejection: { reason: 'The IBAN does not match the cheque.' } });
    expect((seenInit.headers as Record<string, string>)['Idempotency-Key']).toBe('key-1');
    expect(result).toMatchObject({ status: 'rejected', rejectionReason: 'The IBAN does not match the cheque.', reviewedBy: { role: 'finance' } });
  });

  it('maps a missing reason to a field error', async () => {
    globalThis.fetch = (async () =>
      json({ errors: [{ code: 'rejection_reason_required', message: 'Enter a reason.', field: 'rejection.reason' }] }, 422)) as typeof fetch;

    await expect(client().reject('candidate-1', '', 'key-2')).rejects.toEqual({
      code: 'VALIDATION_FAILED', message: 'Enter a reason.', field: 'rejection.reason',
    });
  });
});

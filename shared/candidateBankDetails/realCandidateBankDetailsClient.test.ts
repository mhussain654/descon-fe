// Runs under both web's Vitest (jsdom -- has `FormData`/`File`) and mobile's
// Jest (React Native also polyfills both), mirroring
// shared/candidateDocuments/realCandidateDocumentsClient.test.ts's identical
// rationale.
import { createApiClient } from '../api-client';
import { createCandidateBankDetailsClient } from './realCandidateBankDetailsClient';

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
  return { data, meta: { request_id: 'req-1', timestamp: '2026-08-28T12:00:00Z' }, errors: [] };
}

function errorEnvelope(errors: Array<{ code: string; message: string; field?: string }>) {
  return { errors, request_id: 'req-1', timestamp: '2026-08-28T12:00:00Z' };
}

function bankDetailPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 'd86f5c87-4379-433a-9a29-c8c3d51f859a',
    status: 'submitted',
    account_title: 'Ahmed Ali',
    account_number: '****************6702',
    bank_name: 'Meezan Bank',
    proof: { file_name: 'cheque.pdf', content_type: 'application/pdf', file_size: 123456, uploaded_at: '2026-08-28T12:00:00Z' },
    submitted_at: '2026-08-28T12:00:00Z',
    updated_at: '2026-08-28T12:00:00Z',
    ...overrides,
  };
}

function buildClient(locale: 'en' | 'ur' = 'en') {
  const apiClient = createApiClient({ baseUrl: 'http://example.test/api/v1' });
  return createCandidateBankDetailsClient({ apiClient, getLocale: () => locale });
}

describe('createCandidateBankDetailsClient (real) -- getBankDetail', () => {
  it('fetches with the bearer token and locale headers', async () => {
    let seenUrl = '';
    let seenHeaders: Record<string, string> = {};
    stubFetch(async (url, init) => {
      seenUrl = String(url);
      seenHeaders = (init as RequestInit)?.headers as Record<string, string>;
      return jsonResponse(successEnvelope({ status: 'missing', bank_detail: null }));
    });

    const client = buildClient('ur');
    await client.getBankDetail('candidate-access-token');

    expect(seenUrl).toBe('http://example.test/api/v1/candidate/bank_details');
    expect(seenHeaders.Authorization).toBe('Bearer candidate-access-token');
    expect(seenHeaders['X-Locale']).toBe('ur');
  });

  it('maps a missing state with a null bank detail', async () => {
    stubFetch(async () => jsonResponse(successEnvelope({ status: 'missing', bank_detail: null })));

    const client = buildClient();
    const summary = await client.getBankDetail('token');

    expect(summary).toEqual({ status: 'missing', bankDetail: null });
  });

  it('maps a submitted bank detail, snake_case to camelCase, with the masked account number passed through unchanged', async () => {
    stubFetch(async () => jsonResponse(successEnvelope({ status: 'submitted', bank_detail: bankDetailPayload() })));

    const client = buildClient();
    const summary = await client.getBankDetail('token');

    expect(summary).toEqual({
      status: 'submitted',
      bankDetail: {
        id: 'd86f5c87-4379-433a-9a29-c8c3d51f859a',
        status: 'submitted',
        accountTitle: 'Ahmed Ali',
        accountNumber: '****************6702',
        bankName: 'Meezan Bank',
        proof: { fileName: 'cheque.pdf', contentType: 'application/pdf', fileSize: 123456, uploadedAt: '2026-08-28T12:00:00Z' },
        submittedAt: '2026-08-28T12:00:00Z',
        updatedAt: '2026-08-28T12:00:00Z',
      },
    });
  });

  it('maps a 401 to SESSION_EXPIRED', async () => {
    stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'unauthorized', message: 'Session expired.' }]), { status: 401 }));

    const client = buildClient();
    await expect(client.getBankDetail('token')).rejects.toEqual({ code: 'SESSION_EXPIRED' });
  });

  it('maps a 403 inactive_account to INACTIVE_ACCOUNT', async () => {
    stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'inactive_account', message: 'Inactive.' }]), { status: 403 }));

    const client = buildClient();
    await expect(client.getBankDetail('token')).rejects.toEqual({ code: 'INACTIVE_ACCOUNT', message: 'Inactive.' });
  });

  it('maps a network failure to NETWORK_ERROR', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });

    const client = buildClient();
    await expect(client.getBankDetail('token')).rejects.toEqual({ code: 'NETWORK_ERROR' });
  });
});

describe('createCandidateBankDetailsClient (real) -- submitBankDetail', () => {
  // The client accepts a pre-built FormData (never a typed File input) --
  // matching CandidateDocumentsClient.uploadDocument's identical,
  // platform-agnostic convention: web builds this from a real File, mobile
  // from an expo-picker asset's {uri, name, type} shape, but the client
  // itself never needs to know which.
  function formData() {
    const data = new FormData();
    data.append('bank_detail[account_title]', 'Ahmed Ali');
    data.append('bank_detail[account_number]', 'PK36SCBL0000001123456702');
    data.append('bank_detail[bank_name]', 'Meezan Bank');
    data.append('bank_detail[proof]', new Blob(['pdf-bytes'], { type: 'application/pdf' }), 'cheque.pdf');
    return data;
  }

  it('PUTs the pre-built FormData with the bearer token, locale and idempotency key -- never setting Content-Type manually', async () => {
    let seenInit: RequestInit | undefined;
    stubFetch(async (_url, init) => {
      seenInit = init as RequestInit;
      return jsonResponse(successEnvelope({ status: 'submitted', bank_detail: bankDetailPayload() }), { status: 201 });
    });

    const client = buildClient('ur');
    const result = await client.submitBankDetail({ accessToken: 'candidate-access-token', formData: formData(), idempotencyKey: 'submit-key-1' });

    expect(seenInit?.method).toBe('PUT');
    const headers = seenInit?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer candidate-access-token');
    expect(headers['X-Locale']).toBe('ur');
    expect(headers['Idempotency-Key']).toBe('submit-key-1');
    expect(headers['Content-Type']).toBeUndefined();
    expect(seenInit?.body).toBeInstanceOf(FormData);

    expect(result.status).toBe('submitted');
    expect(result.bankDetail?.accountTitle).toBe('Ahmed Ali');
  });

  it('sends the exact multipart field names the backend expects', async () => {
    let seenBody: FormData | undefined;
    stubFetch(async (_url, init) => {
      seenBody = (init as RequestInit)?.body as FormData;
      return jsonResponse(successEnvelope({ status: 'submitted', bank_detail: bankDetailPayload() }), { status: 201 });
    });

    const client = buildClient();
    await client.submitBankDetail({ accessToken: 'token', formData: formData() });

    expect(seenBody?.get('bank_detail[account_title]')).toBe('Ahmed Ali');
    expect(seenBody?.get('bank_detail[account_number]')).toBe('PK36SCBL0000001123456702');
    expect(seenBody?.get('bank_detail[bank_name]')).toBe('Meezan Bank');
    expect(seenBody?.get('bank_detail[proof]')).toBeInstanceOf(Blob);
  });

  it('omits the Idempotency-Key header when none is supplied', async () => {
    let seenInit: RequestInit | undefined;
    stubFetch(async (_url, init) => {
      seenInit = init as RequestInit;
      return jsonResponse(successEnvelope({ status: 'submitted', bank_detail: bankDetailPayload() }), { status: 201 });
    });

    const client = buildClient();
    await client.submitBankDetail({ accessToken: 'token', formData: formData() });

    const headers = seenInit?.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBeUndefined();
  });

  it.each([
    ['no_current_assignment', 'NO_CURRENT_ASSIGNMENT'],
    ['missing_account_title', 'MISSING_ACCOUNT_TITLE'],
    ['missing_account_number', 'MISSING_ACCOUNT_NUMBER'],
    ['invalid_account_number', 'INVALID_ACCOUNT_NUMBER'],
    ['missing_bank_name', 'MISSING_BANK_NAME'],
    ['missing_proof', 'MISSING_PROOF'],
    ['unsupported_file_type', 'UNSUPPORTED_FILE_TYPE'],
    ['file_too_large', 'FILE_TOO_LARGE'],
    ['empty_file', 'EMPTY_FILE'],
  ])('maps a 422 %s to %s, preserving the localized server message and field', async (serverCode, expectedCode) => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: serverCode, message: `localized: ${serverCode}`, field: 'bank_detail.account_number' }]), {
        status: 422,
      })
    );

    const client = buildClient();
    await expect(client.submitBankDetail({ accessToken: 'token', formData: formData(), idempotencyKey: 'k' })).rejects.toEqual({
      code: expectedCode,
      message: `localized: ${serverCode}`,
      field: 'bank_detail.account_number',
    });
  });

  it('maps a 409 idempotency conflict to CONFLICT, never presenting it as success', async () => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: 'idempotency_conflict', message: 'The idempotency key does not match the original request.' }]), {
        status: 409,
      })
    );

    const client = buildClient();
    await expect(client.submitBankDetail({ accessToken: 'token', formData: formData(), idempotencyKey: 'k' })).rejects.toEqual({
      code: 'CONFLICT',
      message: 'The idempotency key does not match the original request.',
    });
  });

  it('maps a 403 inactive_account to INACTIVE_ACCOUNT', async () => {
    stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'inactive_account', message: 'Inactive.' }]), { status: 403 }));

    const client = buildClient();
    await expect(client.submitBankDetail({ accessToken: 'token', formData: formData(), idempotencyKey: 'k' })).rejects.toEqual({
      code: 'INACTIVE_ACCOUNT',
      message: 'Inactive.',
    });
  });

  it('maps a 401 to SESSION_EXPIRED', async () => {
    stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'unauthorized', message: 'Expired.' }]), { status: 401 }));

    const client = buildClient();
    await expect(client.submitBankDetail({ accessToken: 'token', formData: formData(), idempotencyKey: 'k' })).rejects.toEqual({
      code: 'SESSION_EXPIRED',
    });
  });

  it('maps a 429 to RATE_LIMITED with the Retry-After seconds', async () => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: 'rate_limited', message: 'Too many requests.' }]), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '20' },
      })
    );

    const client = buildClient();
    await expect(client.submitBankDetail({ accessToken: 'token', formData: formData(), idempotencyKey: 'k' })).rejects.toEqual({
      code: 'RATE_LIMITED',
      retryAfterSeconds: 20,
    });
  });

  it('maps a 5xx to SERVER_ERROR', async () => {
    stubFetch(async () => new Response('Internal Server Error', { status: 500 }));

    const client = buildClient();
    await expect(client.submitBankDetail({ accessToken: 'token', formData: formData(), idempotencyKey: 'k' })).rejects.toEqual({
      code: 'SERVER_ERROR',
    });
  });

  it('maps a network failure to NETWORK_ERROR', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });

    const client = buildClient();
    await expect(client.submitBankDetail({ accessToken: 'token', formData: formData(), idempotencyKey: 'k' })).rejects.toEqual({
      code: 'NETWORK_ERROR',
    });
  });
});

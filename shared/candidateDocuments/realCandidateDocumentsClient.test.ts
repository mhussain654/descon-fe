// Runs under both web's Vitest (jsdom -- has `FormData`) and mobile's Jest
// (React Native also polyfills `FormData`, so this file needs no `hasFile`-
// style guard the way shared/adminCandidateImport's tests do for `File`).
import { createApiClient } from '../api-client';
import { createCandidateDocumentsClient } from './realCandidateDocumentsClient';

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
  return { errors, request_id: 'req-1', timestamp: '2026-08-26T09:00:00Z' };
}

function checklistItemPayload(overrides: Record<string, unknown> = {}) {
  return {
    requirement_code: 'passport',
    name: 'Passport',
    required: true,
    status: 'missing',
    replacement_allowed: true,
    document: null,
    ...overrides,
  };
}

function documentPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: '30fcedd6-7fe6-4d12-a5ae-f6b5ef3d91dd',
    file_name: 'passport.pdf',
    content_type: 'application/pdf',
    file_size: 123456,
    uploaded_at: '2026-08-26T12:00:00Z',
    ...overrides,
  };
}

function buildClient(locale: 'en' | 'ur' = 'en') {
  const apiClient = createApiClient({ baseUrl: 'http://example.test/api/v1' });
  return createCandidateDocumentsClient({ apiClient, getLocale: () => locale });
}

describe('createCandidateDocumentsClient (real) -- getChecklist', () => {
  it('fetches the checklist with the bearer token and locale headers', async () => {
    let seenUrl = '';
    let seenHeaders: Record<string, string> = {};
    stubFetch(async (url, init) => {
      seenUrl = String(url);
      seenHeaders = (init as RequestInit)?.headers as Record<string, string>;
      return jsonResponse(successEnvelope([checklistItemPayload()]));
    });

    const client = buildClient('ur');
    await client.getChecklist('candidate-access-token');

    expect(seenUrl).toBe('http://example.test/api/v1/candidate/documents');
    expect(seenHeaders.Authorization).toBe('Bearer candidate-access-token');
    expect(seenHeaders['X-Locale']).toBe('ur');
  });

  it('never sends a candidate id in the request path -- identity comes only from the bearer token', async () => {
    let seenUrl = '';
    stubFetch(async (url) => {
      seenUrl = String(url);
      return jsonResponse(successEnvelope([checklistItemPayload()]));
    });

    const client = buildClient();
    await client.getChecklist('candidate-access-token-xyz');

    expect(seenUrl).not.toContain('candidate-access-token-xyz');
    expect(seenUrl).toBe('http://example.test/api/v1/candidate/documents');
  });

  it('maps every supported status', async () => {
    const statuses = ['missing', 'uploaded', 'pending_review', 'verified', 'rejected'] as const;
    stubFetch(async () =>
      jsonResponse(
        successEnvelope(statuses.map((status, index) => checklistItemPayload({ requirement_code: `req-${index}`, status })))
      )
    );

    const client = buildClient();
    const checklist = await client.getChecklist('token');

    expect(checklist.map((item) => item.status)).toEqual(statuses);
  });

  it('falls back an unrecognized future status to "unknown" rather than crashing or exposing the raw code', async () => {
    stubFetch(async () => jsonResponse(successEnvelope([checklistItemPayload({ status: 'awaiting_translation' })])));

    const client = buildClient();
    const checklist = await client.getChecklist('token');

    expect(checklist[0].status).toBe('unknown');
  });

  it('maps a null document through unchanged for a missing requirement', async () => {
    stubFetch(async () => jsonResponse(successEnvelope([checklistItemPayload({ status: 'missing', document: null })])));

    const client = buildClient();
    const checklist = await client.getChecklist('token');

    expect(checklist[0].document).toBeNull();
  });

  it('maps uploaded document metadata, snake_case to camelCase', async () => {
    stubFetch(async () =>
      jsonResponse(successEnvelope([checklistItemPayload({ status: 'uploaded', document: documentPayload() })]))
    );

    const client = buildClient();
    const checklist = await client.getChecklist('token');

    expect(checklist[0].document).toEqual({
      id: '30fcedd6-7fe6-4d12-a5ae-f6b5ef3d91dd',
      fileName: 'passport.pdf',
      contentType: 'application/pdf',
      fileSize: 123456,
      uploadedAt: '2026-08-26T12:00:00Z',
    });
  });

  it('maps PCC issue date, expiry date and compliance status', async () => {
    stubFetch(async () =>
      jsonResponse(
        successEnvelope([
          checklistItemPayload({
            requirement_code: 'police_character',
            status: 'uploaded',
            document: documentPayload({ issued_on: '2026-02-01', expires_on: '2026-08-01', compliance_status: 'near_expiry' }),
          }),
        ])
      )
    );

    const client = buildClient();
    const checklist = await client.getChecklist('token');

    expect(checklist[0].document).toMatchObject({
      issuedOn: '2026-02-01',
      expiresOn: '2026-08-01',
      complianceStatus: 'near_expiry',
    });
  });

  it.each(['current', 'near_expiry', 'expired', 'not_applicable'])('maps compliance_status %s through unchanged', async (status) => {
    stubFetch(async () =>
      jsonResponse(
        successEnvelope([checklistItemPayload({ document: documentPayload({ compliance_status: status }) })])
      )
    );

    const client = buildClient();
    const checklist = await client.getChecklist('token');

    expect(checklist[0].document?.complianceStatus).toBe(status);
  });

  it('falls back an unrecognized compliance_status to "unknown" rather than crashing or exposing the raw value', async () => {
    stubFetch(async () =>
      jsonResponse(successEnvelope([checklistItemPayload({ document: documentPayload({ compliance_status: 'some_future_value' }) })]))
    );

    const client = buildClient();
    const checklist = await client.getChecklist('token');

    expect(checklist[0].document?.complianceStatus).toBe('unknown');
  });

  it('leaves issuedOn/expiresOn/complianceStatus undefined for a non-PCC document', async () => {
    stubFetch(async () => jsonResponse(successEnvelope([checklistItemPayload({ document: documentPayload() })])));

    const client = buildClient();
    const checklist = await client.getChecklist('token');

    expect(checklist[0].document?.issuedOn).toBeUndefined();
    expect(checklist[0].document?.expiresOn).toBeUndefined();
    expect(checklist[0].document?.complianceStatus).toBeUndefined();
  });

  it('maps the rejection reason for a rejected document', async () => {
    stubFetch(async () =>
      jsonResponse(
        successEnvelope([
          checklistItemPayload({ status: 'rejected', document: documentPayload({ rejection_reason: 'Document is unreadable.' }) }),
        ])
      )
    );

    const client = buildClient();
    const checklist = await client.getChecklist('token');

    expect(checklist[0].document?.rejectionReason).toBe('Document is unreadable.');
  });

  it('leaves rejectionReason undefined for a document that has not been rejected', async () => {
    stubFetch(async () => jsonResponse(successEnvelope([checklistItemPayload({ document: documentPayload() })])));

    const client = buildClient();
    const checklist = await client.getChecklist('token');

    expect(checklist[0].document?.rejectionReason).toBeUndefined();
  });

  it('renders the backend-localized name directly -- never a hardcoded frontend name', async () => {
    stubFetch(async () => jsonResponse(successEnvelope([checklistItemPayload({ name: 'پاسپورٹ' })])));

    const client = buildClient('ur');
    const checklist = await client.getChecklist('token');

    expect(checklist[0].name).toBe('پاسپورٹ');
  });

  it('drops an item with no usable requirement_code rather than crashing the whole checklist', async () => {
    stubFetch(async () =>
      jsonResponse(
        successEnvelope([
          checklistItemPayload({ requirement_code: 'valid_item' }),
          { name: 'Broken item', required: true, status: 'missing', replacement_allowed: false, document: null },
        ])
      )
    );

    const client = buildClient();
    const checklist = await client.getChecklist('token');

    expect(checklist).toHaveLength(1);
    expect(checklist[0].requirementCode).toBe('valid_item');
  });

  it('falls back to a humanized requirement code when name is missing, never crashing', async () => {
    stubFetch(async () =>
      jsonResponse(
        successEnvelope([
          { requirement_code: 'next_of_kin_cnic', required: true, status: 'missing', replacement_allowed: false, document: null },
        ])
      )
    );

    const client = buildClient();
    const checklist = await client.getChecklist('token');

    expect(checklist[0].name).toBe('Next Of Kin Cnic');
  });

  it('returns an empty checklist rather than crashing when the response body is not an array', async () => {
    stubFetch(async () => jsonResponse(successEnvelope(null)));

    const client = buildClient();
    await expect(client.getChecklist('token')).resolves.toEqual([]);
  });

  it('maps a 401 to SESSION_EXPIRED', async () => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: 'unauthorized', message: 'Session expired.' }]), { status: 401 })
    );

    const client = buildClient();
    await expect(client.getChecklist('token')).rejects.toEqual({ code: 'SESSION_EXPIRED' });
  });

  it('maps a 403 inactive_account to INACTIVE_ACCOUNT, never a generic permission error', async () => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: 'inactive_account', message: 'This account is inactive.' }]), { status: 403 })
    );

    const client = buildClient();
    await expect(client.getChecklist('token')).rejects.toEqual({
      code: 'INACTIVE_ACCOUNT',
      message: 'This account is inactive.',
    });
  });

  it('maps offline to OFFLINE', async () => {
    const apiClient = createApiClient({ baseUrl: 'http://example.test/api/v1', isOnline: () => false });
    const client = createCandidateDocumentsClient({ apiClient, getLocale: () => 'en' });
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });

    await expect(client.getChecklist('token')).rejects.toEqual({ code: 'OFFLINE' });
  });

  it('maps a network failure to NETWORK_ERROR', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });

    const client = buildClient();
    await expect(client.getChecklist('token')).rejects.toEqual({ code: 'NETWORK_ERROR' });
  });

  it('maps a 5xx to SERVER_ERROR', async () => {
    stubFetch(async () => new Response('Internal Server Error', { status: 500 }));

    const client = buildClient();
    await expect(client.getChecklist('token')).rejects.toEqual({ code: 'SERVER_ERROR' });
  });
});

describe('createCandidateDocumentsClient (real) -- uploadDocument', () => {
  function formDataWithFile() {
    const formData = new FormData();
    formData.append('candidate_document[requirement_code]', 'passport');
    formData.append('candidate_document[file]', new Blob(['pdf-bytes'], { type: 'application/pdf' }), 'passport.pdf');
    return formData;
  }

  it('posts the pre-built FormData with the bearer token, locale and idempotency key -- never setting Content-Type manually', async () => {
    let seenInit: RequestInit | undefined;
    stubFetch(async (_url, init) => {
      seenInit = init as RequestInit;
      return jsonResponse(successEnvelope(checklistItemPayload({ status: 'uploaded', document: documentPayload() })), {
        status: 201,
      });
    });

    const client = buildClient('ur');
    const result = await client.uploadDocument({
      accessToken: 'candidate-access-token',
      requirementCode: 'passport',
      formData: formDataWithFile(),
      idempotencyKey: 'upload-key-1',
    });

    expect(seenInit?.method).toBe('POST');
    const headers = seenInit?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer candidate-access-token');
    expect(headers['X-Locale']).toBe('ur');
    expect(headers['Idempotency-Key']).toBe('upload-key-1');
    expect(headers['Content-Type']).toBeUndefined();
    expect(seenInit?.body).toBeInstanceOf(FormData);
    expect(result.status).toBe('uploaded');
    expect(result.document?.fileName).toBe('passport.pdf');
  });

  it('sends the exact multipart field names the backend expects', async () => {
    let seenBody: FormData | undefined;
    stubFetch(async (_url, init) => {
      seenBody = (init as RequestInit)?.body as FormData;
      return jsonResponse(successEnvelope(checklistItemPayload({ status: 'uploaded' })), { status: 201 });
    });

    const client = buildClient();
    await client.uploadDocument({
      accessToken: 'token',
      requirementCode: 'passport',
      formData: formDataWithFile(),
      idempotencyKey: 'upload-key-1',
    });

    expect(seenBody?.get('candidate_document[requirement_code]')).toBe('passport');
    expect(seenBody?.get('candidate_document[file]')).toBeInstanceOf(Blob);
  });

  it('maps a 409 idempotency_conflict to CONFLICT, never presenting it as success', async () => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: 'idempotency_conflict', message: 'The idempotency key does not match the original request.' }]), {
        status: 409,
      })
    );

    const client = buildClient();
    await expect(
      client.uploadDocument({ accessToken: 'token', requirementCode: 'passport', formData: formDataWithFile(), idempotencyKey: 'k' })
    ).rejects.toEqual({ code: 'CONFLICT', message: 'The idempotency key does not match the original request.' });
  });

  it.each([
    ['missing_file', 'MISSING_FILE'],
    ['invalid_requirement', 'INVALID_REQUIREMENT'],
    ['unsupported_file_type', 'UNSUPPORTED_FILE_TYPE'],
    ['file_too_large', 'FILE_TOO_LARGE'],
    ['empty_file', 'EMPTY_FILE'],
    ['replacement_not_allowed', 'REPLACEMENT_NOT_ALLOWED'],
  ])('maps a 422 %s to %s, preserving the localized server message', async (serverCode, expectedCode) => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: serverCode, message: `localized: ${serverCode}` }]), { status: 422 })
    );

    const client = buildClient();
    await expect(
      client.uploadDocument({ accessToken: 'token', requirementCode: 'passport', formData: formDataWithFile(), idempotencyKey: 'k' })
    ).rejects.toEqual({ code: expectedCode, message: `localized: ${serverCode}` });
  });

  it('maps a 403 inactive_account to INACTIVE_ACCOUNT', async () => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: 'inactive_account', message: 'Inactive.' }]), { status: 403 })
    );

    const client = buildClient();
    await expect(
      client.uploadDocument({ accessToken: 'token', requirementCode: 'passport', formData: formDataWithFile(), idempotencyKey: 'k' })
    ).rejects.toEqual({ code: 'INACTIVE_ACCOUNT', message: 'Inactive.' });
  });

  it.each([
    ['validation_failed', 'candidate_document.issued_on', 'Enter the Police Character Certificate issue date.'],
    ['pcc_expiry_not_editable', 'candidate_document.expires_on', 'The Police Character Certificate expiry date is calculated by the server and cannot be provided.'],
  ])('maps a 422 %s to VALIDATION_ERROR with field and message', async (serverCode, field, message) => {
    stubFetch(async () => jsonResponse(errorEnvelope([{ code: serverCode, message, field }]), { status: 422 }));

    const client = buildClient();
    await expect(
      client.uploadDocument({ accessToken: 'token', requirementCode: 'police_character', formData: formDataWithFile(), idempotencyKey: 'k' })
    ).rejects.toEqual({ code: 'VALIDATION_ERROR', message, field });
  });

  it('maps a 401 to SESSION_EXPIRED', async () => {
    stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'unauthorized', message: 'Expired.' }]), { status: 401 }));

    const client = buildClient();
    await expect(
      client.uploadDocument({ accessToken: 'token', requirementCode: 'passport', formData: formDataWithFile(), idempotencyKey: 'k' })
    ).rejects.toEqual({ code: 'SESSION_EXPIRED' });
  });

  it('maps a 429 to RATE_LIMITED with the Retry-After seconds', async () => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: 'rate_limited', message: 'Too many requests.' }]), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '20' },
      })
    );

    const client = buildClient();
    await expect(
      client.uploadDocument({ accessToken: 'token', requirementCode: 'passport', formData: formDataWithFile(), idempotencyKey: 'k' })
    ).rejects.toEqual({ code: 'RATE_LIMITED', retryAfterSeconds: 20 });
  });

  it('maps a 5xx to SERVER_ERROR', async () => {
    stubFetch(async () => new Response('Internal Server Error', { status: 500 }));

    const client = buildClient();
    await expect(
      client.uploadDocument({ accessToken: 'token', requirementCode: 'passport', formData: formDataWithFile(), idempotencyKey: 'k' })
    ).rejects.toEqual({ code: 'SERVER_ERROR' });
  });

  it('maps a network failure to NETWORK_ERROR', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });

    const client = buildClient();
    await expect(
      client.uploadDocument({ accessToken: 'token', requirementCode: 'passport', formData: formDataWithFile(), idempotencyKey: 'k' })
    ).rejects.toEqual({ code: 'NETWORK_ERROR' });
  });
});

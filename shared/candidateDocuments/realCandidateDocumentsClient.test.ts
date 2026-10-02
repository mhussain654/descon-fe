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

function errorEnvelope(errors: Array<{ code: string; message: string; field?: string; details?: Record<string, unknown> }>) {
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
      files: [],
    });
  });

  it('maps every file of a multi-file document, in position order, dropping unknown side codes to null', async () => {
    const files = [
      { id: 'file-2', side_code: 'back', position: 2, file_name: 'back.jpg', content_type: 'image/jpeg', file_size: 200 },
      { id: 'file-1', side_code: 'front', position: 1, file_name: 'front.jpg', content_type: 'image/jpeg', file_size: 100 },
      { id: 'file-3', side_code: 'sideways', position: 3, file_name: 'x.png', content_type: 'image/png', file_size: 50 },
      { side_code: 'front' },
    ];
    stubFetch(async () =>
      jsonResponse(successEnvelope([checklistItemPayload({ status: 'uploaded', document: documentPayload({ files }) })]))
    );

    const checklist = await buildClient().getChecklist('token');

    expect(checklist[0].document?.files).toEqual([
      { id: 'file-1', sideCode: 'front', position: 1, fileName: 'front.jpg', contentType: 'image/jpeg', fileSize: 100 },
      { id: 'file-2', sideCode: 'back', position: 2, fileName: 'back.jpg', contentType: 'image/jpeg', fileSize: 200 },
      { id: 'file-3', sideCode: null, position: 3, fileName: 'x.png', contentType: 'image/png', fileSize: 50 },
    ]);
  });

  it('maps backend order, instructions and upload rules, sorting the checklist by display position', async () => {
    stubFetch(async () =>
      jsonResponse(
        successEnvelope([
          checklistItemPayload({ requirement_code: 'cv', display_position: 5 }),
          checklistItemPayload({
            requirement_code: 'cnic',
            display_position: 2,
            instructions: 'Upload the front and back.',
            minimum_files: 1,
            maximum_files: 2,
            combined_pdf_allowed: true,
            allowed_side_codes: ['combined', 'front', 'back', 'sideways'],
            accepted_content_types: ['application/pdf', 'image/jpeg', 'text/plain'],
            maximum_file_size: 4_000_000,
          }),
          checklistItemPayload({ requirement_code: 'no_position' }),
        ])
      )
    );

    const checklist = await buildClient().getChecklist('token');

    expect(checklist.map((item) => item.requirementCode)).toEqual(['cnic', 'cv', 'no_position']);
    expect(checklist[0]).toMatchObject({
      displayPosition: 2,
      instructions: 'Upload the front and back.',
      uploadRules: {
        minimumFiles: 1,
        maximumFiles: 2,
        combinedPdfAllowed: true,
        allowedSideCodes: ['combined', 'front', 'back'],
        acceptedContentTypes: ['application/pdf', 'image/jpeg'],
        maximumFileSize: 4_000_000,
      },
    });
    expect(checklist[1].instructions).toBeNull();
  });

  it('defaults missing upload rules to one file of any supported type', async () => {
    stubFetch(async () => jsonResponse(successEnvelope([checklistItemPayload()])));

    const [item] = await buildClient().getChecklist('token');

    expect(item.uploadRules).toEqual({
      minimumFiles: 1,
      maximumFiles: 1,
      combinedPdfAllowed: false,
      allowedSideCodes: [],
      acceptedContentTypes: ['application/pdf', 'image/jpeg', 'image/png'],
      maximumFileSize: 5 * 1024 * 1024,
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

  it('maps the review date once a document has been reviewed', async () => {
    stubFetch(async () =>
      jsonResponse(
        successEnvelope([
          checklistItemPayload({ status: 'verified', document: documentPayload({ reviewed_at: '2026-08-21T09:00:00Z' }) }),
        ])
      )
    );

    const client = buildClient();
    const checklist = await client.getChecklist('token');

    expect(checklist[0].document?.reviewedAt).toBe('2026-08-21T09:00:00Z');
  });

  it('leaves reviewedAt undefined for a document that has not been reviewed', async () => {
    stubFetch(async () => jsonResponse(successEnvelope([checklistItemPayload({ document: documentPayload() })])));

    const client = buildClient();
    const checklist = await client.getChecklist('token');

    expect(checklist[0].document?.reviewedAt).toBeUndefined();
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
    ['malware_detected', 'MALWARE_DETECTED'],
  ])('maps a 422 %s to %s, preserving the localized server message', async (serverCode, expectedCode) => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: serverCode, message: `localized: ${serverCode}` }]), { status: 422 })
    );

    const client = buildClient();
    await expect(
      client.uploadDocument({ accessToken: 'token', requirementCode: 'passport', formData: formDataWithFile(), idempotencyKey: 'k' })
    ).rejects.toEqual({ code: expectedCode, message: `localized: ${serverCode}` });
  });

  it('maps invalid_document_files with its reason, ignoring an unknown reason', async () => {
    const upload = (reason: string) => {
      stubFetch(async () =>
        jsonResponse(
          errorEnvelope([
            { code: 'invalid_document_files', message: 'Upload both sides.', field: 'candidate_document.files', details: { reason } },
          ]),
          { status: 422 }
        )
      );
      return buildClient().uploadDocument({ accessToken: 'token', requirementCode: 'cnic', formData: formDataWithFile(), idempotencyKey: 'k' });
    };

    await expect(upload('incomplete_side_pair')).rejects.toEqual({
      code: 'INVALID_DOCUMENT_FILES',
      message: 'Upload both sides.',
      field: 'candidate_document.files',
      reason: 'incomplete_side_pair',
    });
    await expect(upload('brand_new_reason')).rejects.toMatchObject({ code: 'INVALID_DOCUMENT_FILES', reason: undefined });
  });

  it('maps a 503 malware_scan_unavailable to MALWARE_SCAN_UNAVAILABLE, not a generic server error', async () => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: 'malware_scan_unavailable', message: 'Unavailable.' }]), { status: 503 })
    );

    await expect(
      buildClient().uploadDocument({ accessToken: 'token', requirementCode: 'cv', formData: formDataWithFile(), idempotencyKey: 'k' })
    ).rejects.toMatchObject({ code: 'MALWARE_SCAN_UNAVAILABLE', message: 'Unavailable.' });
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

function documentAccessPayload(overrides: Record<string, unknown> = {}) {
  return {
    document_id: '30fcedd6-7fe6-4d12-a5ae-f6b5ef3d91dd',
    file_id: 'file-1',
    url: '/rails/active_storage/blobs/proxy/abc/passport.pdf',
    expires_at: '2026-08-26T12:05:00Z',
    ...overrides,
  };
}

describe('createCandidateDocumentsClient (real) -- requestDocumentAccess', () => {
  it('posts to the document-specific access path with the bearer token and locale, mapping the response to camelCase', async () => {
    let seenUrl: string | undefined;
    let seenInit: RequestInit | undefined;
    stubFetch(async (url, init) => {
      seenUrl = url as string;
      seenInit = init as RequestInit;
      return jsonResponse(successEnvelope(documentAccessPayload()));
    });

    const client = buildClient('ur');
    const result = await client.requestDocumentAccess('candidate-access-token', '30fcedd6-7fe6-4d12-a5ae-f6b5ef3d91dd');

    expect(seenUrl).toBe('http://example.test/api/v1/candidate/documents/30fcedd6-7fe6-4d12-a5ae-f6b5ef3d91dd/access');
    expect(seenInit?.method).toBe('POST');
    const headers = seenInit?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer candidate-access-token');
    expect(headers['X-Locale']).toBe('ur');
    expect(result).toEqual({
      documentId: '30fcedd6-7fe6-4d12-a5ae-f6b5ef3d91dd',
      fileId: 'file-1',
      url: '/rails/active_storage/blobs/proxy/abc/passport.pdf',
      expiresAt: '2026-08-26T12:05:00Z',
    });
  });

  it('sends no body when no disposition is requested, leaving the server to default to inline', async () => {
    let seenInit: RequestInit | undefined;
    stubFetch(async (_url, init) => {
      seenInit = init as RequestInit;
      return jsonResponse(successEnvelope(documentAccessPayload()));
    });

    const client = buildClient();
    await client.requestDocumentAccess('token', '30fcedd6-7fe6-4d12-a5ae-f6b5ef3d91dd');

    expect(seenInit?.body).toBeUndefined();
  });

  it('sends the requested disposition as a JSON body', async () => {
    let seenInit: RequestInit | undefined;
    stubFetch(async (_url, init) => {
      seenInit = init as RequestInit;
      return jsonResponse(successEnvelope(documentAccessPayload()));
    });

    const client = buildClient();
    await client.requestDocumentAccess('token', '30fcedd6-7fe6-4d12-a5ae-f6b5ef3d91dd', 'attachment');

    expect(seenInit?.body).toBe(JSON.stringify({ disposition: 'attachment' }));
    const headers = seenInit?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('asks for one specific file of a multi-file document', async () => {
    let seenInit: RequestInit | undefined;
    stubFetch(async (_url, init) => {
      seenInit = init as RequestInit;
      return jsonResponse(successEnvelope(documentAccessPayload({ file_id: 'file-2' })));
    });

    const result = await buildClient().requestDocumentAccess('token', 'doc-1', 'inline', 'file-2');

    expect(seenInit?.body).toBe(JSON.stringify({ disposition: 'inline', file_id: 'file-2' }));
    expect(result.fileId).toBe('file-2');
  });

  it('maps a 404 to NOT_FOUND -- a foreign, unrelated or superseded document id', async () => {
    stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'not_found', message: 'Not found.' }]), { status: 404 }));

    const client = buildClient();
    await expect(client.requestDocumentAccess('token', 'some-id')).rejects.toEqual({
      code: 'NOT_FOUND',
      message: 'Not found.',
    });
  });

  it('maps a 422 document_attachment_missing to DOCUMENT_ATTACHMENT_MISSING, preserving the localized server message', async () => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: 'document_attachment_missing', message: 'The requested document file is unavailable.' }]), {
        status: 422,
      })
    );

    const client = buildClient();
    await expect(client.requestDocumentAccess('token', 'some-id')).rejects.toEqual({
      code: 'DOCUMENT_ATTACHMENT_MISSING',
      message: 'The requested document file is unavailable.',
    });
  });

  it('maps a 403 inactive_account to INACTIVE_ACCOUNT', async () => {
    stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'inactive_account', message: 'Inactive.' }]), { status: 403 }));

    const client = buildClient();
    await expect(client.requestDocumentAccess('token', 'some-id')).rejects.toEqual({
      code: 'INACTIVE_ACCOUNT',
      message: 'Inactive.',
    });
  });

  it('maps a 401 to SESSION_EXPIRED', async () => {
    stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'unauthorized', message: 'Expired.' }]), { status: 401 }));

    const client = buildClient();
    await expect(client.requestDocumentAccess('token', 'some-id')).rejects.toEqual({ code: 'SESSION_EXPIRED' });
  });

  it('maps a 429 to RATE_LIMITED with the Retry-After seconds', async () => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: 'rate_limited', message: 'Too many requests.' }]), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '20' },
      })
    );

    const client = buildClient();
    await expect(client.requestDocumentAccess('token', 'some-id')).rejects.toEqual({ code: 'RATE_LIMITED', retryAfterSeconds: 20 });
  });

  it('maps a 5xx to SERVER_ERROR', async () => {
    stubFetch(async () => new Response('Internal Server Error', { status: 500 }));

    const client = buildClient();
    await expect(client.requestDocumentAccess('token', 'some-id')).rejects.toEqual({ code: 'SERVER_ERROR' });
  });

  it('maps a network failure to NETWORK_ERROR', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });

    const client = buildClient();
    await expect(client.requestDocumentAccess('token', 'some-id')).rejects.toEqual({ code: 'NETWORK_ERROR' });
  });

  it('maps offline to OFFLINE', async () => {
    const apiClient = createApiClient({ baseUrl: 'http://example.test/api/v1', isOnline: () => false });
    const client = createCandidateDocumentsClient({ apiClient, getLocale: () => 'en' });
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });

    await expect(client.requestDocumentAccess('token', 'some-id')).rejects.toEqual({ code: 'OFFLINE' });
  });
});

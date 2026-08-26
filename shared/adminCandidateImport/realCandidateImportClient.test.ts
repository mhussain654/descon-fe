// Runs under both web's Vitest (jsdom -- has `File`) and mobile's Jest
// (no `File` global) because this file lives under shared/, which mobile's
// Jest config also roots into (see mobile/package.json). Every test needing
// `File` is guarded, matching realStaffAuthClient.test.ts's
// `hasSessionStorage` pattern -- this module itself is web-only (admin
// import never ships on mobile) and is simply never imported there.
import { createApiClient } from '../api-client';
import type { StaffAuthClient } from '../auth/staffTypes';
import { createCandidateImportClient } from './realCandidateImportClient';

const hasFile = typeof File !== 'undefined';

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

function resultPayload(overrides: Record<string, unknown> = {}) {
  return {
    successful_rows: 2,
    failed_rows: 0,
    skipped_rows: 0,
    total_rows: 2,
    errors: [],
    ...overrides,
  };
}

/** A fake StaffAuthClient that just attaches a fixed token and rethrows whatever `makeRequest` throws -- authenticatedDataRequest's own refresh/401 behavior is covered separately in realStaffAuthClient.test.ts. */
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
  const staffAuthClient = fakeStaffAuthClient();
  const client = createCandidateImportClient({ apiClient, staffAuthClient, getLocale: () => locale });
  return { client };
}

describe('createCandidateImportClient (real)', () => {
  (hasFile ? it : it.skip)('posts multipart/form-data with the file, bearer token, locale and idempotency key', async () => {
    let seenUrl = '';
    let seenInit: RequestInit | undefined;
    stubFetch(async (url, init) => {
      seenUrl = String(url);
      seenInit = init as RequestInit;
      return jsonResponse(successEnvelope(resultPayload()), { status: 201 });
    });

    const { client } = buildClient('ur');
    const file = new File(['a,b\n1,2'], 'candidates.csv', { type: 'text/csv' });
    const result = await client.importCandidates(file, 'import-key-1');

    expect(seenUrl).toBe('http://example.test/api/v1/admin/candidate_imports');
    expect(seenInit?.method).toBe('POST');
    const headers = seenInit?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer staff-access-token');
    expect(headers['X-Locale']).toBe('ur');
    expect(headers['Idempotency-Key']).toBe('import-key-1');
    // FormData must never be sent with a manually-set Content-Type -- the
    // browser needs to add its own multipart boundary.
    expect(headers['Content-Type']).toBeUndefined();
    expect(seenInit?.body).toBeInstanceOf(FormData);
    expect((seenInit?.body as FormData).get('candidate_import[file]')).toBe(file);

    expect(result).toEqual({ successfulRows: 2, failedRows: 0, skippedRows: 0, totalRows: 2, errors: [] });
  });

  (hasFile ? it : it.skip)('omits the Idempotency-Key header when none is supplied', async () => {
    let seenInit: RequestInit | undefined;
    stubFetch(async (_url, init) => {
      seenInit = init as RequestInit;
      return jsonResponse(successEnvelope(resultPayload()), { status: 201 });
    });

    const { client } = buildClient();
    await client.importCandidates(new File(['x'], 'candidates.csv', { type: 'text/csv' }));

    const headers = seenInit?.headers as Record<string, string>;
    expect('Idempotency-Key' in headers).toBe(false);
  });

  (hasFile ? it : it.skip)('maps row-level results, including already-localized messages, unchanged', async () => {
    stubFetch(async () =>
      jsonResponse(
        successEnvelope(
          resultPayload({
            successful_rows: 0,
            failed_rows: 1,
            skipped_rows: 1,
            errors: [
              { row: 2, field: 'cnic', code: 'invalid_cnic', message: 'Enter a valid CNIC.' },
              { row: 3, field: 'reference_number', code: 'duplicate_reference_number', message: 'Already exists.' },
            ],
          })
        )
      )
    );

    const { client } = buildClient();
    const result = await client.importCandidates(new File(['x'], 'candidates.csv', { type: 'text/csv' }));

    expect(result.errors).toEqual([
      { row: 2, field: 'cnic', code: 'invalid_cnic', message: 'Enter a valid CNIC.' },
      { row: 3, field: 'reference_number', code: 'duplicate_reference_number', message: 'Already exists.' },
    ]);
  });

  (hasFile ? it : it.skip)('maps a 422 to INVALID_FILE with the server-provided message', async () => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: 'missing_headers', message: 'Missing required headers: cnic.' }]), {
        status: 422,
      })
    );

    const { client } = buildClient();
    await expect(client.importCandidates(new File(['x'], 'candidates.csv'))).rejects.toEqual({
      code: 'INVALID_FILE',
      message: 'Missing required headers: cnic.',
      retryAfterSeconds: undefined,
    });
  });

  (hasFile ? it : it.skip)('maps an ordinary permission-denied 403 to FORBIDDEN', async () => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: 'forbidden', message: 'Not permitted.' }]), { status: 403 })
    );

    const { client } = buildClient();
    await expect(client.importCandidates(new File(['x'], 'candidates.csv'))).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  (hasFile ? it : it.skip)('maps a 403 with serverCode inactive_account to INACTIVE_ACCOUNT, distinct from an ordinary FORBIDDEN', async () => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: 'inactive_account', message: 'This account is inactive.' }]), {
        status: 403,
      })
    );

    const { client } = buildClient();
    await expect(client.importCandidates(new File(['x'], 'candidates.csv'))).rejects.toMatchObject({
      code: 'INACTIVE_ACCOUNT',
    });
  });

  (hasFile ? it : it.skip)('maps a 409 to CONFLICT', async () => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: 'idempotency_conflict', message: 'Already processing.' }]), {
        status: 409,
      })
    );

    const { client } = buildClient();
    await expect(client.importCandidates(new File(['x'], 'candidates.csv'))).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  (hasFile ? it : it.skip)('maps a 429 to RATE_LIMITED with the Retry-After seconds', async () => {
    stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'rate_limited', message: 'Too many requests.' }]), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '30' },
    }));

    const { client } = buildClient();
    await expect(client.importCandidates(new File(['x'], 'candidates.csv'))).rejects.toEqual({
      code: 'RATE_LIMITED',
      message: 'Too many requests.',
      retryAfterSeconds: 30,
    });
  });

  (hasFile ? it : it.skip)('maps a 5xx to SERVER_ERROR', async () => {
    stubFetch(async () => new Response('Internal Server Error', { status: 500 }));

    const { client } = buildClient();
    await expect(client.importCandidates(new File(['x'], 'candidates.csv'))).rejects.toEqual({ code: 'SERVER_ERROR' });
  });

  (hasFile ? it : it.skip)('maps a network failure to NETWORK_ERROR', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });

    const { client } = buildClient();
    await expect(client.importCandidates(new File(['x'], 'candidates.csv'))).rejects.toEqual({ code: 'NETWORK_ERROR' });
  });

  it('maps a SESSION_EXPIRED staff-auth error through unchanged', async () => {
    const apiClient = createApiClient({ baseUrl: 'http://example.test/api/v1' });
    const staffAuthClient: StaffAuthClient = {
      signIn: async () => {
        throw new Error('not used');
      },
      restoreSession: async () => null,
      signOut: async () => undefined,
      authenticatedRequest: async () => {
        throw new Error('not used');
      },
      authenticatedDataRequest: async () => {
        throw { code: 'SESSION_EXPIRED' };
      },
    };
    const client = createCandidateImportClient({ apiClient, staffAuthClient, getLocale: () => 'en' });

    const fakeFile = hasFile ? new File(['x'], 'candidates.csv') : ({} as File);
    await expect(client.importCandidates(fakeFile)).rejects.toEqual({ code: 'SESSION_EXPIRED' });
  });
});

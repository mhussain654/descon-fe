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

function preflightPayload(overrides: Record<string, unknown> = {}) {
  return {
    import_id: 'import-1',
    preflight_token: 'preflight-token-1',
    expires_at: '2026-08-26T09:30:00Z',
    accepted_rows: 2,
    rejected_rows: 0,
    warning_count: 0,
    total_rows: 2,
    errors: [],
    ...overrides,
  };
}

function commitPayload(overrides: Record<string, unknown> = {}) {
  return {
    import_id: 'import-1',
    status: 'committed',
    total_rows: 2,
    successful_rows: 2,
    failed_rows: 0,
    skipped_rows: 0,
    imported_rows: 2,
    rejected_rows: 0,
    warning_count: 0,
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
  describe('downloadTemplate', () => {
    it('fetches the real backend-served template with auth/locale headers, and reads the filename from Content-Disposition', async () => {
      let seenUrl = '';
      let seenInit: RequestInit | undefined;
      stubFetch(async (url, init) => {
        seenUrl = String(url);
        seenInit = init as RequestInit;
        return new Response('full_name,cnic\nJane,42101-1234567-1', {
          status: 200,
          headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="candidate-import-template-v1.csv"' },
        });
      });

      const { client } = buildClient('ur');
      const result = await client.downloadTemplate();

      expect(seenUrl).toBe('http://example.test/api/v1/admin/candidate_imports/template');
      const headers = seenInit?.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer staff-access-token');
      expect(headers['X-Locale']).toBe('ur');
      expect(result).toEqual({ content: 'full_name,cnic\nJane,42101-1234567-1', filename: 'candidate-import-template-v1.csv' });
    });

    it('falls back to a default filename when the response has no Content-Disposition header', async () => {
      stubFetch(async () => new Response('a,b', { status: 200 }));
      const { client } = buildClient();

      const result = await client.downloadTemplate();

      expect(result.filename).toBe('candidate-import-template-v1.csv');
    });

    it('maps a 403 to FORBIDDEN', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'forbidden', message: 'Not permitted.' }]), { status: 403 }));
      const { client } = buildClient();

      await expect(client.downloadTemplate()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
  });

  describe('preflightImport', () => {
    (hasFile ? it : it.skip)('posts multipart/form-data with the file, bearer token and locale', async () => {
      let seenUrl = '';
      let seenInit: RequestInit | undefined;
      stubFetch(async (url, init) => {
        seenUrl = String(url);
        seenInit = init as RequestInit;
        return jsonResponse(successEnvelope(preflightPayload()), { status: 201 });
      });

      const { client } = buildClient('ur');
      const file = new File(['a,b\n1,2'], 'candidates.csv', { type: 'text/csv' });
      const result = await client.preflightImport(file);

      expect(seenUrl).toBe('http://example.test/api/v1/admin/candidate_imports/preflight');
      expect(seenInit?.method).toBe('POST');
      const headers = seenInit?.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer staff-access-token');
      expect(headers['X-Locale']).toBe('ur');
      // FormData must never be sent with a manually-set Content-Type -- the
      // browser needs to add its own multipart boundary.
      expect(headers['Content-Type']).toBeUndefined();
      expect(seenInit?.body).toBeInstanceOf(FormData);
      expect((seenInit?.body as FormData).get('candidate_import[file]')).toBe(file);

      expect(result).toEqual({
        importId: 'import-1',
        preflightToken: 'preflight-token-1',
        expiresAt: '2026-08-26T09:30:00Z',
        acceptedRows: 2,
        rejectedRows: 0,
        warningCount: 0,
        totalRows: 2,
        errors: [],
      });
    });

    (hasFile ? it : it.skip)('maps row-level results, including already-localized messages, unchanged', async () => {
      stubFetch(async () =>
        jsonResponse(
          successEnvelope(
            preflightPayload({
              accepted_rows: 0,
              rejected_rows: 2,
              errors: [
                { row: 2, field: 'cnic', code: 'invalid_cnic', message: 'Enter a valid CNIC.' },
                { row: 3, field: 'reference_number', code: 'duplicate_reference_number', message: 'Already exists.' },
              ],
            })
          )
        )
      );

      const { client } = buildClient();
      const result = await client.preflightImport(new File(['x'], 'candidates.csv', { type: 'text/csv' }));

      expect(result.acceptedRows).toBe(0);
      expect(result.errors).toEqual([
        { row: 2, field: 'cnic', code: 'invalid_cnic', message: 'Enter a valid CNIC.' },
        { row: 3, field: 'reference_number', code: 'duplicate_reference_number', message: 'Already exists.' },
      ]);
    });

    (hasFile ? it : it.skip)('maps a 422 to INVALID_FILE with the server-provided message', async () => {
      stubFetch(async () =>
        jsonResponse(errorEnvelope([{ code: 'missing_headers', message: 'Missing required headers: cnic.' }]), { status: 422 })
      );

      const { client } = buildClient();
      await expect(client.preflightImport(new File(['x'], 'candidates.csv'))).rejects.toEqual({
        code: 'INVALID_FILE',
        message: 'Missing required headers: cnic.',
      });
    });

    (hasFile ? it : it.skip)('maps an ordinary permission-denied 403 to FORBIDDEN', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'forbidden', message: 'Not permitted.' }]), { status: 403 }));

      const { client } = buildClient();
      await expect(client.preflightImport(new File(['x'], 'candidates.csv'))).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    (hasFile ? it : it.skip)('maps a 403 with serverCode inactive_account to INACTIVE_ACCOUNT', async () => {
      stubFetch(async () =>
        jsonResponse(errorEnvelope([{ code: 'inactive_account', message: 'This account is inactive.' }]), { status: 403 })
      );

      const { client } = buildClient();
      await expect(client.preflightImport(new File(['x'], 'candidates.csv'))).rejects.toMatchObject({ code: 'INACTIVE_ACCOUNT' });
    });

    (hasFile ? it : it.skip)('maps a network failure to NETWORK_ERROR', async () => {
      stubFetch(async () => {
        throw new TypeError('Failed to fetch');
      });

      const { client } = buildClient();
      await expect(client.preflightImport(new File(['x'], 'candidates.csv'))).rejects.toEqual({ code: 'NETWORK_ERROR' });
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
      await expect(client.preflightImport(fakeFile)).rejects.toEqual({ code: 'SESSION_EXPIRED' });
    });
  });

  describe('commitImport', () => {
    it('posts a JSON body with the preflight token and the Idempotency-Key header, never multipart', async () => {
      let seenUrl = '';
      let seenInit: RequestInit | undefined;
      stubFetch(async (url, init) => {
        seenUrl = String(url);
        seenInit = init as RequestInit;
        return jsonResponse(successEnvelope(commitPayload()));
      });

      const { client } = buildClient('ur');
      const result = await client.commitImport('preflight-token-1', 'commit-key-1');

      expect(seenUrl).toBe('http://example.test/api/v1/admin/candidate_imports/commit');
      expect(seenInit?.method).toBe('POST');
      const headers = seenInit?.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer staff-access-token');
      expect(headers['X-Locale']).toBe('ur');
      expect(headers['Idempotency-Key']).toBe('commit-key-1');
      expect(headers['Content-Type']).toBe('application/json');
      expect(JSON.parse(seenInit?.body as string)).toEqual({ candidate_import: { preflight_token: 'preflight-token-1' } });

      expect(result).toEqual({
        importId: 'import-1',
        status: 'committed',
        totalRows: 2,
        successfulRows: 2,
        failedRows: 0,
        skippedRows: 0,
        importedRows: 2,
        rejectedRows: 0,
        warningCount: 0,
        errors: [],
      });
    });

    it('omits the Idempotency-Key header when none is supplied', async () => {
      let seenInit: RequestInit | undefined;
      stubFetch(async (_url, init) => {
        seenInit = init as RequestInit;
        return jsonResponse(successEnvelope(commitPayload()));
      });

      const { client } = buildClient();
      await client.commitImport('preflight-token-1');

      const headers = seenInit?.headers as Record<string, string>;
      expect('Idempotency-Key' in headers).toBe(false);
    });

    it('maps a partial-success result (some rows rejected at commit time) through unchanged', async () => {
      stubFetch(async () =>
        jsonResponse(
          successEnvelope(
            commitPayload({
              successful_rows: 1,
              failed_rows: 1,
              imported_rows: 1,
              rejected_rows: 1,
              errors: [{ row: 3, field: 'cnic', code: 'duplicate_candidate', message: 'A candidate with this CNIC already exists.' }],
            })
          )
        )
      );

      const { client } = buildClient();
      const result = await client.commitImport('preflight-token-1');

      expect(result.importedRows).toBe(1);
      expect(result.rejectedRows).toBe(1);
      expect(result.errors).toEqual([{ row: 3, field: 'cnic', code: 'duplicate_candidate', message: 'A candidate with this CNIC already exists.' }]);
    });

    it('maps a 422 with the preflight-token field to PREFLIGHT_EXPIRED, distinct from a plain file-level error', async () => {
      stubFetch(async () =>
        jsonResponse(
          errorEnvelope([
            { code: 'validation_failed', message: 'This import preview has expired.', field: 'candidate_import.preflight_token' },
          ]),
          { status: 422 }
        )
      );

      const { client } = buildClient();
      await expect(client.commitImport('preflight-token-1')).rejects.toEqual({
        code: 'PREFLIGHT_EXPIRED',
        message: 'This import preview has expired.',
      });
    });

    it('maps any other 422 to INVALID_FILE', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'validation_failed', message: 'Bad request.' }]), { status: 422 }));

      const { client } = buildClient();
      await expect(client.commitImport('preflight-token-1')).rejects.toEqual({ code: 'INVALID_FILE', message: 'Bad request.' });
    });

    it('maps an ordinary permission-denied 403 to FORBIDDEN', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'forbidden', message: 'Not permitted.' }]), { status: 403 }));

      const { client } = buildClient();
      await expect(client.commitImport('preflight-token-1')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('maps a 403 with serverCode inactive_account to INACTIVE_ACCOUNT', async () => {
      stubFetch(async () =>
        jsonResponse(errorEnvelope([{ code: 'inactive_account', message: 'This account is inactive.' }]), { status: 403 })
      );

      const { client } = buildClient();
      await expect(client.commitImport('preflight-token-1')).rejects.toMatchObject({ code: 'INACTIVE_ACCOUNT' });
    });

    it('maps a 409 to CONFLICT', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'idempotency_conflict', message: 'Already processing.' }]), { status: 409 }));

      const { client } = buildClient();
      await expect(client.commitImport('preflight-token-1')).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('maps a 429 to RATE_LIMITED with the Retry-After seconds', async () => {
      stubFetch(async () =>
        jsonResponse(errorEnvelope([{ code: 'rate_limited', message: 'Too many requests.' }]), {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '30' },
        })
      );

      const { client } = buildClient();
      await expect(client.commitImport('preflight-token-1')).rejects.toEqual({
        code: 'RATE_LIMITED',
        message: 'Too many requests.',
        retryAfterSeconds: 30,
      });
    });

    it('maps a 5xx to SERVER_ERROR', async () => {
      stubFetch(async () => new Response('Internal Server Error', { status: 500 }));

      const { client } = buildClient();
      await expect(client.commitImport('preflight-token-1')).rejects.toEqual({ code: 'SERVER_ERROR' });
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

      await expect(client.commitImport('preflight-token-1')).rejects.toEqual({ code: 'SESSION_EXPIRED' });
    });
  });
});

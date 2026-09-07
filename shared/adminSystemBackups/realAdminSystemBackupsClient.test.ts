import { createApiClient } from '../api-client';
import type { StaffAuthClient } from '../auth/staffTypes';
import { createAdminSystemBackupsClient } from './realAdminSystemBackupsClient';

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
  return { data, meta: { request_id: 'req-1', timestamp: '2026-09-06T09:00:00Z', ...meta }, errors: [] };
}

function errorEnvelope(errors: Array<{ code: string; message: string }>) {
  return { errors, request_id: 'req-1' };
}

function backupPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: '2099d502-a67a-4d4b-a15a-58df5324b2d1',
    status: 'succeeded',
    taken_at: '2026-09-06T00:00:00Z',
    byte_size: 10_485_760,
    checksum_sha256: 'b3abbcd58b14094ba6c0fea222f44367d07df2bab6c2ecd15a5b1645f93d556c',
    duration_seconds: 42,
    error_message: null,
    ...overrides,
  };
}

/** Mirrors realAdminAuditEventsClient.test.ts's identical fake -- authenticatedDataRequest's own refresh/401 behavior is covered separately in realStaffAuthClient.test.ts. */
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
  return createAdminSystemBackupsClient({ apiClient, staffAuthClient: fakeStaffAuthClient(), getLocale: () => locale });
}

describe('createAdminSystemBackupsClient (real)', () => {
  describe('listBackups', () => {
    it('fetches backups with the bearer token, locale and pagination metadata', async () => {
      let seenUrl = '';
      let seenHeaders: Record<string, string> = {};
      stubFetch(async (url, init) => {
        seenUrl = String(url);
        seenHeaders = (init as RequestInit)?.headers as Record<string, string>;
        return jsonResponse(
          successEnvelope([backupPayload()], { pagination: { page: 1, per_page: 20, total_count: 1, total_pages: 1 } })
        );
      });

      const client = buildClient('ur');
      const result = await client.listBackups({});

      expect(seenUrl).toBe('http://example.test/api/v1/admin/system_database_backups');
      expect(seenHeaders.Authorization).toBe('Bearer staff-access-token');
      expect(seenHeaders['X-Locale']).toBe('ur');
      expect(result.items).toEqual([
        {
          id: '2099d502-a67a-4d4b-a15a-58df5324b2d1',
          status: 'succeeded',
          takenAt: '2026-09-06T00:00:00Z',
          byteSize: 10_485_760,
          checksumSha256: 'b3abbcd58b14094ba6c0fea222f44367d07df2bab6c2ecd15a5b1645f93d556c',
          durationSeconds: 42,
          errorMessage: null,
        },
      ]);
      expect(result.pagination).toEqual({ page: 1, perPage: 20, totalCount: 1, totalPages: 1 });
    });

    it('sends page.number and page.size as query params when given', async () => {
      let seenUrl = '';
      stubFetch(async (url) => {
        seenUrl = String(url);
        return jsonResponse(successEnvelope([]));
      });

      await buildClient().listBackups({ number: 2, size: 10 });

      expect(seenUrl).toContain('page%5Bnumber%5D=2');
      expect(seenUrl).toContain('page%5Bsize%5D=10');
    });

    it('maps a 403 forbidden response', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'forbidden', message: 'Not allowed.' }]), { status: 403 }));

      await expect(buildClient().listBackups({})).rejects.toEqual({ code: 'FORBIDDEN', message: 'Not allowed.' });
    });
  });

  describe('requestAccess', () => {
    it('posts to the access endpoint and returns the signed URL', async () => {
      let seenUrl = '';
      let seenMethod = '';
      stubFetch(async (url, init) => {
        seenUrl = String(url);
        seenMethod = (init as RequestInit)?.method ?? 'GET';
        return jsonResponse(
          successEnvelope({
            backup_id: '2099d502-a67a-4d4b-a15a-58df5324b2d1',
            url: '/rails/active_storage/disk/abc/database_backup.sql.gz',
            expires_at: '2026-09-06T10:05:00Z',
          }),
          {}
        );
      });

      const access = await buildClient().requestAccess('2099d502-a67a-4d4b-a15a-58df5324b2d1');

      expect(seenUrl).toBe('http://example.test/api/v1/admin/system_database_backups/2099d502-a67a-4d4b-a15a-58df5324b2d1/access');
      expect(seenMethod).toBe('POST');
      expect(access).toEqual({
        backupId: '2099d502-a67a-4d4b-a15a-58df5324b2d1',
        url: '/rails/active_storage/disk/abc/database_backup.sql.gz',
        expiresAt: '2026-09-06T10:05:00Z',
      });
    });

    it('maps a 422 archive-not-found response', async () => {
      stubFetch(async () =>
        jsonResponse(errorEnvelope([{ code: 'backup_archive_not_found', message: "This backup's archive is not available." }]), {
          status: 422,
        })
      );

      await expect(buildClient().requestAccess('some-id')).rejects.toEqual({
        code: 'ARCHIVE_NOT_FOUND',
        message: "This backup's archive is not available.",
      });
    });
  });
});

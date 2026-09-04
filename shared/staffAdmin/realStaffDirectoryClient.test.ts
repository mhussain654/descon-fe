import { createApiClient } from '../api-client';
import type { StaffAuthClient } from '../auth/staffTypes';
import { createStaffDirectoryClient } from './realStaffDirectoryClient';

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
  return { data, meta: { request_id: 'req-1', timestamp: '2026-09-04T09:00:00Z', ...meta }, errors: [] };
}

function errorEnvelope(errors: Array<{ code: string; message: string; field?: string }>) {
  return { errors, request_id: 'req-1' };
}

function staffPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 'staff-1',
    email: 'admin@descon.com',
    role: 'admin',
    staff_state: 'active',
    active: true,
    created_at: '2026-06-01T00:00:00Z',
    ...overrides,
  };
}

/** A fake StaffAuthClient that just attaches a fixed token and rethrows whatever `makeRequest` throws -- authenticatedDataRequest's own refresh/401 behavior is covered separately in realStaffAuthClient.test.ts (same rationale as realAdminPaymentsClient.test.ts's identical fake). */
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
  const client = createStaffDirectoryClient({ apiClient, staffAuthClient, getLocale: () => locale });
  return { client };
}

describe('createStaffDirectoryClient (real)', () => {
  describe('listStaff', () => {
    it('fetches the real backend list with auth/locale headers and maps the response, without a name field', async () => {
      let seenUrl = '';
      let seenInit: RequestInit | undefined;
      stubFetch(async (url, init) => {
        seenUrl = String(url);
        seenInit = init as RequestInit;
        return jsonResponse(successEnvelope([staffPayload()], { pagination: { page: 1, per_page: 100, total_count: 1, total_pages: 1 } }));
      });

      const { client } = buildClient('ur');
      const staff = await client.listStaff({ query: 'admin', role: 'admin', status: 'active' });

      expect(seenUrl).toBe(
        'http://example.test/api/v1/users?filter%5Bemail%5D=admin&filter%5Brole%5D=admin&filter%5Bstaff_state%5D=active&page%5Bsize%5D=100'
      );
      const headers = seenInit?.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer staff-access-token');
      expect(headers['X-Locale']).toBe('ur');

      expect(staff).toEqual([{ id: 'staff-1', email: 'admin@descon.com', role: 'admin', status: 'active', createdAt: '2026-06-01T00:00:00Z' }]);
      expect(staff[0]).not.toHaveProperty('name');
    });

    it('fetches with no filters when none are supplied', async () => {
      let seenUrl = '';
      stubFetch(async (url) => {
        seenUrl = String(url);
        return jsonResponse(successEnvelope([]));
      });
      const { client } = buildClient();

      await client.listStaff();

      expect(seenUrl).toBe('http://example.test/api/v1/users?page%5Bsize%5D=100');
    });

    it('maps SESSION_EXPIRED from a StaffAuthError straight through', async () => {
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
      const client = createStaffDirectoryClient({ apiClient, staffAuthClient, getLocale: () => 'en' });

      await expect(client.listStaff()).rejects.toMatchObject({ status: 401, serverCode: 'session_expired' });
    });
  });

  describe('inviteStaff', () => {
    it('posts email/role and unwraps the created staff member', async () => {
      let seenUrl = '';
      let seenInit: RequestInit | undefined;
      stubFetch(async (url, init) => {
        seenUrl = String(url);
        seenInit = init as RequestInit;
        return jsonResponse(
          successEnvelope({ user: staffPayload({ id: 'staff-2', email: 'new@descon.com', role: 'hr', staff_state: 'invited', active: false }), message: 'ok' }),
          { status: 201 }
        );
      });
      const { client } = buildClient();

      const invited = await client.inviteStaff({ email: 'new@descon.com', role: 'hr' });

      expect(seenUrl).toBe('http://example.test/api/v1/users');
      const body = JSON.parse(seenInit?.body as string);
      expect(body).toEqual({ user: { email: 'new@descon.com', role: 'hr' } });
      expect(invited).toEqual({ id: 'staff-2', email: 'new@descon.com', role: 'hr', status: 'invited', createdAt: '2026-06-01T00:00:00Z' });
    });

    it('rejects a duplicate email with the backend-localized field-addressable message', async () => {
      stubFetch(async () =>
        jsonResponse(errorEnvelope([{ code: 'validation_failed', field: 'email', message: 'Email has already been taken' }]), { status: 422 })
      );
      const { client } = buildClient();

      await expect(client.inviteStaff({ email: 'admin@descon.com', role: 'hr' })).rejects.toMatchObject({
        status: 422,
        errors: [{ code: 'validation_failed', field: 'email', message: 'Email has already been taken' }],
      });
    });
  });

  describe('updateStaffRole / updateStaffStatus', () => {
    it('sends only the role field on a role update', async () => {
      let seenUrl = '';
      let seenInit: RequestInit | undefined;
      stubFetch(async (url, init) => {
        seenUrl = String(url);
        seenInit = init as RequestInit;
        return jsonResponse(successEnvelope({ user: staffPayload({ role: 'finance' }), message: 'ok' }));
      });
      const { client } = buildClient();

      const updated = await client.updateStaffRole('staff-1', 'finance');

      expect(seenUrl).toBe('http://example.test/api/v1/users/staff-1');
      expect(seenInit?.method).toBe('PATCH');
      expect(JSON.parse(seenInit?.body as string)).toEqual({ user: { role: 'finance' } });
      expect(updated.role).toBe('finance');
    });

    it('sends only the staff_state field on a status update', async () => {
      let seenInit: RequestInit | undefined;
      stubFetch(async (_url, init) => {
        seenInit = init as RequestInit;
        return jsonResponse(successEnvelope({ user: staffPayload({ staff_state: 'suspended' }), message: 'ok' }));
      });
      const { client } = buildClient();

      const updated = await client.updateStaffStatus('staff-1', 'suspended');

      expect(JSON.parse(seenInit?.body as string)).toEqual({ user: { staff_state: 'suspended' } });
      expect(updated.status).toBe('suspended');
    });

    it('rejects demoting the last remaining admin with a field-addressable validation error, not a 409', async () => {
      stubFetch(async () =>
        jsonResponse(errorEnvelope([{ code: 'validation_failed', field: 'user.role', message: 'At least one active admin must remain.' }]), {
          status: 422,
        })
      );
      const { client } = buildClient();

      await expect(client.updateStaffRole('staff-1', 'hr')).rejects.toMatchObject({ status: 422, field: 'user.role' });
    });

    it('maps an unknown staff id to a 404', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'not_found', message: 'Not found.' }]), { status: 404 }));
      const { client } = buildClient();

      await expect(client.updateStaffStatus('does-not-exist', 'suspended')).rejects.toMatchObject({ status: 404 });
    });
  });
});

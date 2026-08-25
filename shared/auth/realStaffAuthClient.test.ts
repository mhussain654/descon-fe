// Framework-agnostic: runs under both web's Vitest and mobile's Jest (staff
// auth is web-only today, but this file is portable like every other
// shared/auth client test).
import { createApiClient } from '../api-client';
import { createStaffAuthClient } from './realStaffAuthClient';

const originalFetch = globalThis.fetch;

function stubFetch(impl: typeof fetch) {
  globalThis.fetch = impl as typeof fetch;
}

// This file lives under shared/, so it also runs under mobile's Jest suite
// (its config roots include ../shared) even though staff auth is web-only --
// and React Native's test environment has no `sessionStorage` global at all.
// Persistence-dependent assertions are guarded/skipped accordingly, same
// pattern as staffAuthClient.test.ts.
const hasSessionStorage = typeof sessionStorage !== 'undefined';

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (hasSessionStorage) sessionStorage.clear();
});

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

/** Every 2xx descon-be response is `{ data, meta, errors: [] }` (openapi.yaml's SuccessEnvelope). */
function successEnvelope(data: unknown) {
  return { data, meta: { request_id: 'req-1', timestamp: '2026-08-23T09:00:00Z' }, errors: [] };
}

function errorEnvelope(errors: Array<{ code: string; message: string; field?: string }>) {
  return { errors, request_id: 'req-1' };
}

function sessionPayload(overrides: Record<string, unknown> = {}) {
  return {
    access_token: 'access-1',
    refresh_token: 'refresh-1',
    token_type: 'Bearer',
    expires_in: 900,
    message: 'Login succeeded.',
    session: { id: 'session-1' },
    user: { id: 'staff-1', email: 'admin@descon.com', role: 'admin' },
    ...overrides,
  };
}

function buildClient() {
  const apiClient = createApiClient({ baseUrl: 'http://example.test/api/v1' });
  return createStaffAuthClient({ apiClient });
}

describe('createStaffAuthClient (real)', () => {
  describe('signIn', () => {
    it('posts credentials and returns the server-declared session', async () => {
      const fetchCalls: Array<[string, RequestInit]> = [];
      stubFetch(async (url, init) => {
        fetchCalls.push([String(url), init as RequestInit]);
        return jsonResponse(successEnvelope(sessionPayload()), { status: 201 });
      });

      const client = buildClient();
      const session = await client.signIn({ email: 'admin@descon.com', password: 'Passw0rd!' });

      expect(session).toEqual({
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        staffId: 'staff-1',
        email: 'admin@descon.com',
        role: 'admin',
        expiresAt: expect.any(String),
      });
      const [url, init] = fetchCalls[0];
      expect(url).toBe('http://example.test/api/v1/auth/login');
      expect(JSON.parse(init.body as string)).toEqual({ auth: { email: 'admin@descon.com', password: 'Passw0rd!' } });
    });

    it('never logs the password -- only the documented request body is sent', async () => {
      const loggedCalls: unknown[][] = [];
      const originalLog = console.log;
      // eslint-disable-next-line no-console
      console.log = (...args: unknown[]) => {
        loggedCalls.push(args);
      };
      try {
        stubFetch(async () => jsonResponse(successEnvelope(sessionPayload()), { status: 201 }));
        const client = buildClient();
        await client.signIn({ email: 'admin@descon.com', password: 'super-secret' });
        expect(loggedCalls.flat().join(' ')).not.toContain('super-secret');
      } finally {
        // eslint-disable-next-line no-console
        console.log = originalLog;
      }
    });

    it('maps 401 unauthorized to INVALID_CREDENTIALS', async () => {
      stubFetch(async () =>
        jsonResponse(errorEnvelope([{ code: 'unauthorized', message: 'Invalid credentials.' }]), { status: 401 })
      );
      const client = buildClient();
      await expect(client.signIn({ email: 'a@b.com', password: 'x' })).rejects.toEqual({
        code: 'INVALID_CREDENTIALS',
      });
    });

    it('maps 403 inactive_account to INACTIVE_ACCOUNT', async () => {
      stubFetch(async () =>
        jsonResponse(errorEnvelope([{ code: 'inactive_account', message: 'This account is inactive.' }]), {
          status: 403,
        })
      );
      const client = buildClient();
      await expect(client.signIn({ email: 'a@b.com', password: 'x' })).rejects.toEqual({
        code: 'INACTIVE_ACCOUNT',
      });
    });

    it('maps 429 rate_limited to TOO_MANY_ATTEMPTS', async () => {
      stubFetch(async () =>
        jsonResponse(errorEnvelope([{ code: 'rate_limited', message: 'Too many attempts.' }]), { status: 429 })
      );
      const client = buildClient();
      await expect(client.signIn({ email: 'a@b.com', password: 'x' })).rejects.toEqual({
        code: 'TOO_MANY_ATTEMPTS',
      });
    });

    it('maps a network failure to NETWORK_ERROR', async () => {
      stubFetch(async () => {
        throw new TypeError('Failed to fetch');
      });
      const client = buildClient();
      await expect(client.signIn({ email: 'a@b.com', password: 'x' })).rejects.toEqual({ code: 'NETWORK_ERROR' });
    });

    it('maps an offline failure to OFFLINE', async () => {
      stubFetch(async () => {
        throw new TypeError('Failed to fetch');
      });
      const apiClient = createApiClient({ baseUrl: 'http://example.test/api/v1', isOnline: () => false });
      const client = createStaffAuthClient({ apiClient });
      await expect(client.signIn({ email: 'a@b.com', password: 'x' })).rejects.toEqual({ code: 'OFFLINE' });
    });

    (hasSessionStorage ? it : it.skip)('persists only the refresh token, keeping the access token out of storage', async () => {
      stubFetch(async () => jsonResponse(successEnvelope(sessionPayload()), { status: 201 }));
      const client = buildClient();
      await client.signIn({ email: 'admin@descon.com', password: 'Passw0rd!' });

      expect(sessionStorage.getItem('descon.staffRefreshToken')).toBe('refresh-1');
      // Nothing under any key contains the access token.
      const allStoredValues = Array.from({ length: sessionStorage.length }, (_, i) =>
        sessionStorage.getItem(sessionStorage.key(i) as string)
      );
      expect(allStoredValues.some((value) => value?.includes('access-1'))).toBe(false);
    });
  });

  describe('restoreSession', () => {
    it('resolves null when no refresh token was ever persisted', async () => {
      const client = buildClient();
      await expect(client.restoreSession()).resolves.toBeNull();
    });

    (hasSessionStorage ? it : it.skip)('refreshes and returns a session when a refresh token is persisted', async () => {
      sessionStorage.setItem('descon.staffRefreshToken', 'stored-refresh');
      const fetchCalls: Array<[string, RequestInit]> = [];
      stubFetch(async (url, init) => {
        fetchCalls.push([String(url), init as RequestInit]);
        return jsonResponse(successEnvelope(sessionPayload({ refresh_token: 'rotated-refresh' })));
      });

      const client = buildClient();
      const session = await client.restoreSession();

      expect(session?.staffId).toBe('staff-1');
      const [url, init] = fetchCalls[0];
      expect(url).toBe('http://example.test/api/v1/auth/refresh');
      expect(JSON.parse(init.body as string)).toEqual({ auth: { refresh_token: 'stored-refresh' } });
      // The rotated refresh token replaces the old one.
      expect(sessionStorage.getItem('descon.staffRefreshToken')).toBe('rotated-refresh');
    });

    (hasSessionStorage ? it : it.skip)('resolves null and clears storage when the refresh token is invalid or the session was revoked', async () => {
      sessionStorage.setItem('descon.staffRefreshToken', 'stale-refresh');
      stubFetch(async () =>
        jsonResponse(errorEnvelope([{ code: 'invalid_refresh_token', message: 'Invalid or expired refresh token.' }]), {
          status: 401,
        })
      );
      const client = buildClient();
      await expect(client.restoreSession()).resolves.toBeNull();
      expect(sessionStorage.getItem('descon.staffRefreshToken')).toBeNull();
    });

    (hasSessionStorage ? it : it.skip)('resolves null for a revoked session (session_revoked)', async () => {
      sessionStorage.setItem('descon.staffRefreshToken', 'stale-refresh');
      stubFetch(async () =>
        jsonResponse(errorEnvelope([{ code: 'session_revoked', message: 'Session revoked.' }]), { status: 401 })
      );
      const client = buildClient();
      await expect(client.restoreSession()).resolves.toBeNull();
    });

    (hasSessionStorage ? it : it.skip)('rejects (does not silently claim "no session") on a genuine network failure', async () => {
      sessionStorage.setItem('descon.staffRefreshToken', 'stored-refresh');
      stubFetch(async () => {
        throw new TypeError('Failed to fetch');
      });
      const client = buildClient();
      await expect(client.restoreSession()).rejects.toEqual({ code: 'NETWORK_ERROR' });
    });
  });

  describe('concurrent refresh coordination', () => {
    (hasSessionStorage ? it : it.skip)('shares one refresh operation across concurrent restoreSession calls', async () => {
      sessionStorage.setItem('descon.staffRefreshToken', 'stored-refresh');
      let refreshCallCount = 0;
      stubFetch(async (url) => {
        if (String(url).includes('/auth/refresh')) {
          refreshCallCount += 1;
          return jsonResponse(successEnvelope(sessionPayload()));
        }
        throw new Error(`unexpected fetch to ${url}`);
      });

      const client = buildClient();
      const [first, second, third] = await Promise.all([
        client.restoreSession(),
        client.restoreSession(),
        client.restoreSession(),
      ]);

      expect(refreshCallCount).toBe(1);
      expect(first).toEqual(second);
      expect(second).toEqual(third);
    });

    (hasSessionStorage ? it : it.skip)('a later, non-concurrent refresh runs fresh rather than reusing a settled promise', async () => {
      sessionStorage.setItem('descon.staffRefreshToken', 'stored-refresh');
      let refreshCallCount = 0;
      stubFetch(async () => {
        refreshCallCount += 1;
        return jsonResponse(successEnvelope(sessionPayload({ refresh_token: `refresh-${refreshCallCount}` })));
      });

      const client = buildClient();
      await client.restoreSession();
      await client.restoreSession();

      expect(refreshCallCount).toBe(2);
    });
  });

  describe('signOut', () => {
    it('calls DELETE /auth/logout with the current access token as a Bearer header', async () => {
      const fetchCalls: Array<[string, RequestInit]> = [];
      stubFetch(async (url, init) => {
        fetchCalls.push([String(url), init as RequestInit]);
        if (String(url).includes('/auth/login')) return jsonResponse(successEnvelope(sessionPayload()), { status: 201 });
        return jsonResponse(successEnvelope({ revoked: true, message: 'Session revoked.' }));
      });

      const client = buildClient();
      await client.signIn({ email: 'admin@descon.com', password: 'Passw0rd!' });
      await client.signOut();

      const logoutCall = fetchCalls.find(([url]) => url.includes('/auth/logout'));
      expect(logoutCall).toBeDefined();
      const [url, init] = logoutCall!;
      expect(url).toBe('http://example.test/api/v1/auth/logout');
      expect(init.method).toBe('DELETE');
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer access-1');
    });

    (hasSessionStorage ? it : it.skip)('clears the persisted refresh token even when the server call fails', async () => {
      stubFetch(async (url) => {
        if (String(url).includes('/auth/login')) return jsonResponse(successEnvelope(sessionPayload()), { status: 201 });
        return jsonResponse(errorEnvelope([{ code: 'unauthorized', message: 'Invalid token.' }]), { status: 401 });
      });

      const client = buildClient();
      await client.signIn({ email: 'admin@descon.com', password: 'Passw0rd!' });
      await expect(client.signOut()).resolves.toBeUndefined();
      expect(sessionStorage.getItem('descon.staffRefreshToken')).toBeNull();
    });

    it('deduplicates concurrent signOut calls into a single logout request', async () => {
      let logoutCallCount = 0;
      stubFetch(async (url) => {
        if (String(url).includes('/auth/login')) return jsonResponse(successEnvelope(sessionPayload()), { status: 201 });
        logoutCallCount += 1;
        return jsonResponse(successEnvelope({ revoked: true, message: 'Session revoked.' }));
      });

      const client = buildClient();
      await client.signIn({ email: 'admin@descon.com', password: 'Passw0rd!' });
      await Promise.all([client.signOut(), client.signOut()]);

      expect(logoutCallCount).toBe(1);
    });

    (hasSessionStorage ? it : it.skip)('a refresh already in flight when signOut is called does not revive the session afterwards', async () => {
      sessionStorage.setItem('descon.staffRefreshToken', 'stored-refresh');
      let resolveRefresh: (value: Response) => void;
      let refreshCallCount = 0;
      stubFetch(async (url) => {
        if (String(url).includes('/auth/refresh')) {
          refreshCallCount += 1;
          return new Promise((resolve) => {
            resolveRefresh = resolve;
          });
        }
        return jsonResponse(successEnvelope({ revoked: true, message: 'Session revoked.' }));
      });

      const client = buildClient();
      const restorePromise = client.restoreSession();
      // signOut has no accessToken yet (the refresh above hasn't resolved),
      // so it clears local state immediately without a network call --
      // still, it must bump the epoch so the *stale* refresh, once it does
      // resolve, can't write itself back into shared state afterwards.
      await client.signOut();

      resolveRefresh!(jsonResponse(successEnvelope(sessionPayload())));
      await restorePromise;

      expect(sessionStorage.getItem('descon.staffRefreshToken')).toBeNull();
      expect(refreshCallCount).toBe(1);
    });
  });
});

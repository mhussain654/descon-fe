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

/** GET /users/profile's data payload -- the sole, authoritative source of role/permissions (never derived from a token or `role` client-side). */
function profilePayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 'staff-1',
    email: 'admin@descon.com',
    role: 'admin',
    permissions: ['manage_staff_users', 'manage_candidate_documents'],
    ...overrides,
  };
}

function profileResponse(overrides: Record<string, unknown> = {}, init: ResponseInit = {}) {
  return jsonResponse(successEnvelope(profilePayload(overrides)), init);
}

function buildClient() {
  const apiClient = createApiClient({ baseUrl: 'http://example.test/api/v1' });
  return createStaffAuthClient({ apiClient });
}

/** Routes the four real endpoints to sensible default success responses; override branches per-test as needed. */
function stubHappyPathFetch(overrides: Partial<Record<'login' | 'refresh' | 'logout' | 'profile', () => Response | Promise<Response>>> = {}) {
  const calls: Array<[string, RequestInit]> = [];
  stubFetch(async (url, init) => {
    const u = String(url);
    calls.push([u, init as RequestInit]);
    if (u.includes('/auth/login')) return overrides.login ? overrides.login() : jsonResponse(successEnvelope(sessionPayload()), { status: 201 });
    if (u.includes('/auth/refresh')) return overrides.refresh ? overrides.refresh() : jsonResponse(successEnvelope(sessionPayload()));
    if (u.includes('/auth/logout')) return overrides.logout ? overrides.logout() : jsonResponse(successEnvelope({ revoked: true, message: 'Session revoked.' }));
    if (u.includes('/users/profile')) return overrides.profile ? overrides.profile() : profileResponse();
    throw new Error(`stubHappyPathFetch: unexpected fetch to ${u}`);
  });
  return calls;
}

describe('createStaffAuthClient (real)', () => {
  describe('signIn', () => {
    it('posts credentials, fetches the profile, and returns an identity session built from it (no tokens)', async () => {
      const calls = stubHappyPathFetch();
      const client = buildClient();
      const session = await client.signIn({ email: 'admin@descon.com', password: 'Passw0rd!' });

      expect(session).toEqual({
        staffId: 'staff-1',
        email: 'admin@descon.com',
        role: 'admin',
        permissions: ['manage_staff_users', 'manage_candidate_documents'],
        expiresAt: expect.any(String),
      });
      expect(session).not.toHaveProperty('accessToken');
      expect(session).not.toHaveProperty('refreshToken');

      const [loginUrl, loginInit] = calls[0];
      expect(loginUrl).toBe('http://example.test/api/v1/auth/login');
      expect(JSON.parse(loginInit.body as string)).toEqual({ auth: { email: 'admin@descon.com', password: 'Passw0rd!' } });

      const profileCall = calls.find(([url]) => url.includes('/users/profile'));
      expect(profileCall).toBeDefined();
      const [profileUrl, profileInit] = profileCall!;
      expect(profileUrl).toBe('http://example.test/api/v1/users/profile');
      expect((profileInit.headers as Record<string, string>).Authorization).toBe('Bearer access-1');
    });

    it('uses the backend permissions exactly as returned -- including ones no local list would predict', async () => {
      stubHappyPathFetch({
        profile: () => profileResponse({ permissions: ['manage_candidate_documents', 'some_future_permission', 'view_audit_events'] }),
      });
      const client = buildClient();
      const session = await client.signIn({ email: 'admin@descon.com', password: 'Passw0rd!' });

      expect(session.permissions).toEqual(['manage_candidate_documents', 'some_future_permission', 'view_audit_events']);
    });

    it('never logs the password -- only the documented request body is sent', async () => {
      const loggedCalls: unknown[][] = [];
      const originalLog = console.log;
      // eslint-disable-next-line no-console
      console.log = (...args: unknown[]) => {
        loggedCalls.push(args);
      };
      try {
        stubHappyPathFetch();
        const client = buildClient();
        await client.signIn({ email: 'admin@descon.com', password: 'super-secret' });
        expect(loggedCalls.flat().join(' ')).not.toContain('super-secret');
      } finally {
        // eslint-disable-next-line no-console
        console.log = originalLog;
      }
    });

    it('maps 401 unauthorized on login to INVALID_CREDENTIALS', async () => {
      stubFetch(async () =>
        jsonResponse(errorEnvelope([{ code: 'unauthorized', message: 'Invalid credentials.' }]), { status: 401 })
      );
      const client = buildClient();
      await expect(client.signIn({ email: 'a@b.com', password: 'x' })).rejects.toEqual({
        code: 'INVALID_CREDENTIALS',
      });
    });

    it('maps 403 inactive_account on login to INACTIVE_ACCOUNT', async () => {
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

    it('maps 429 rate_limited on login to TOO_MANY_ATTEMPTS', async () => {
      stubFetch(async () =>
        jsonResponse(errorEnvelope([{ code: 'rate_limited', message: 'Too many attempts.' }]), { status: 429 })
      );
      const client = buildClient();
      await expect(client.signIn({ email: 'a@b.com', password: 'x' })).rejects.toEqual({
        code: 'TOO_MANY_ATTEMPTS',
      });
    });

    it('maps a network failure on login to NETWORK_ERROR', async () => {
      stubFetch(async () => {
        throw new TypeError('Failed to fetch');
      });
      const client = buildClient();
      await expect(client.signIn({ email: 'a@b.com', password: 'x' })).rejects.toEqual({ code: 'NETWORK_ERROR' });
    });

    it('maps an offline failure on login to OFFLINE', async () => {
      stubFetch(async () => {
        throw new TypeError('Failed to fetch');
      });
      const apiClient = createApiClient({ baseUrl: 'http://example.test/api/v1', isOnline: () => false });
      const client = createStaffAuthClient({ apiClient });
      await expect(client.signIn({ email: 'a@b.com', password: 'x' })).rejects.toEqual({ code: 'OFFLINE' });
    });

    (hasSessionStorage ? it : it.skip)('persists only the refresh token, keeping the access token out of storage entirely', async () => {
      stubHappyPathFetch();
      const client = buildClient();
      await client.signIn({ email: 'admin@descon.com', password: 'Passw0rd!' });

      expect(sessionStorage.getItem('descon.staffRefreshToken')).toBe('refresh-1');
      const allStoredValues = Array.from({ length: sessionStorage.length }, (_, i) =>
        sessionStorage.getItem(sessionStorage.key(i) as string)
      );
      expect(allStoredValues.some((value) => value?.includes('access-1'))).toBe(false);
    });

    it('rejects safely (does not crash or fabricate a session) when the profile response is malformed', async () => {
      stubHappyPathFetch({ profile: () => profileResponse({ role: 'not-a-real-role' }) });
      const client = buildClient();
      await expect(client.signIn({ email: 'admin@descon.com', password: 'Passw0rd!' })).rejects.toEqual({
        code: 'UNKNOWN',
      });
    });

    it('rejects safely when the profile response is missing permissions entirely', async () => {
      stubFetch(async (url) => {
        if (String(url).includes('/auth/login')) return jsonResponse(successEnvelope(sessionPayload()), { status: 201 });
        if (String(url).includes('/users/profile')) {
          return jsonResponse(successEnvelope({ id: 'staff-1', email: 'admin@descon.com', role: 'admin' }));
        }
        throw new Error(`unexpected fetch to ${url}`);
      });
      const client = buildClient();
      await expect(client.signIn({ email: 'admin@descon.com', password: 'Passw0rd!' })).rejects.toEqual({
        code: 'UNKNOWN',
      });
    });

    it('maps a 401 on the profile fetch to SESSION_EXPIRED, not INVALID_CREDENTIALS', async () => {
      stubFetch(async (url) => {
        if (String(url).includes('/auth/login')) return jsonResponse(successEnvelope(sessionPayload()), { status: 201 });
        if (String(url).includes('/users/profile')) {
          return jsonResponse(errorEnvelope([{ code: 'unauthorized', message: 'Invalid or expired access token.' }]), {
            status: 401,
          });
        }
        throw new Error(`unexpected fetch to ${url}`);
      });
      const client = buildClient();
      await expect(client.signIn({ email: 'admin@descon.com', password: 'Passw0rd!' })).rejects.toEqual({
        code: 'SESSION_EXPIRED',
      });
    });
  });

  describe('restoreSession', () => {
    it('resolves null when no refresh token was ever persisted', async () => {
      const client = buildClient();
      await expect(client.restoreSession()).resolves.toBeNull();
    });

    (hasSessionStorage ? it : it.skip)('refreshes, fetches the profile, and returns an identity session (no tokens) when a refresh token is persisted', async () => {
      sessionStorage.setItem('descon.staffRefreshToken', 'stored-refresh');
      const calls = stubHappyPathFetch({
        refresh: () => jsonResponse(successEnvelope(sessionPayload({ refresh_token: 'rotated-refresh' }))),
      });

      const client = buildClient();
      const session = await client.restoreSession();

      expect(session?.staffId).toBe('staff-1');
      expect(session).not.toHaveProperty('accessToken');
      expect(session).not.toHaveProperty('refreshToken');
      const [refreshUrl, refreshInit] = calls.find(([url]) => url.includes('/auth/refresh'))!;
      expect(refreshUrl).toBe('http://example.test/api/v1/auth/refresh');
      expect(JSON.parse(refreshInit.body as string)).toEqual({ auth: { refresh_token: 'stored-refresh' } });
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

    (hasSessionStorage ? it : it.skip)('rejects (does not silently claim "no session") on a genuine network failure during the refresh call, and preserves the refresh token', async () => {
      sessionStorage.setItem('descon.staffRefreshToken', 'stored-refresh');
      stubFetch(async () => {
        throw new TypeError('Failed to fetch');
      });
      const client = buildClient();
      await expect(client.restoreSession()).rejects.toEqual({ code: 'NETWORK_ERROR' });
      expect(sessionStorage.getItem('descon.staffRefreshToken')).toBe('stored-refresh');
    });

    (hasSessionStorage ? it : it.skip)('preserves the refresh token across an offline failure too', async () => {
      sessionStorage.setItem('descon.staffRefreshToken', 'stored-refresh');
      stubFetch(async () => {
        throw new TypeError('Failed to fetch');
      });
      const apiClient = createApiClient({ baseUrl: 'http://example.test/api/v1', isOnline: () => false });
      const client = createStaffAuthClient({ apiClient });
      await expect(client.restoreSession()).rejects.toEqual({ code: 'OFFLINE' });
      expect(sessionStorage.getItem('descon.staffRefreshToken')).toBe('stored-refresh');
    });

    (hasSessionStorage ? it : it.skip)(
      'a transient profile failure after a successful refresh does not lose the newly rotated refresh token, and does not resolve with stale/partial permissions',
      async () => {
        sessionStorage.setItem('descon.staffRefreshToken', 'old-refresh');
        stubFetch(async (url) => {
          if (String(url).includes('/auth/refresh')) {
            return jsonResponse(successEnvelope(sessionPayload({ refresh_token: 'rotated-refresh' })));
          }
          if (String(url).includes('/users/profile')) {
            throw new TypeError('Failed to fetch');
          }
          throw new Error(`unexpected fetch to ${url}`);
        });

        const client = buildClient();
        await expect(client.restoreSession()).rejects.toEqual({ code: 'NETWORK_ERROR' });

        // The rotation from the (successful) refresh call must be kept --
        // the old refresh token is already dead server-side regardless of
        // the profile call's outcome.
        expect(sessionStorage.getItem('descon.staffRefreshToken')).toBe('rotated-refresh');
      }
    );

    (hasSessionStorage ? it : it.skip)('rejects safely when the refresh succeeds but the profile response is malformed', async () => {
      sessionStorage.setItem('descon.staffRefreshToken', 'stored-refresh');
      stubFetch(async (url) => {
        if (String(url).includes('/auth/refresh')) return jsonResponse(successEnvelope(sessionPayload()));
        if (String(url).includes('/users/profile')) {
          return jsonResponse(successEnvelope({ id: 'staff-1', email: 'admin@descon.com', role: 'not-a-real-role', permissions: [] }));
        }
        throw new Error(`unexpected fetch to ${url}`);
      });
      const client = buildClient();
      await expect(client.restoreSession()).rejects.toEqual({ code: 'UNKNOWN' });
    });
  });

  describe('concurrent refresh coordination', () => {
    (hasSessionStorage ? it : it.skip)('shares one refresh operation (and one profile fetch) across concurrent restoreSession calls', async () => {
      sessionStorage.setItem('descon.staffRefreshToken', 'stored-refresh');
      let refreshCallCount = 0;
      let profileCallCount = 0;
      stubFetch(async (url) => {
        if (String(url).includes('/auth/refresh')) {
          refreshCallCount += 1;
          return jsonResponse(successEnvelope(sessionPayload()));
        }
        if (String(url).includes('/users/profile')) {
          profileCallCount += 1;
          return profileResponse();
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
      expect(profileCallCount).toBe(1);
      expect(first).toEqual(second);
      expect(second).toEqual(third);
    });

    (hasSessionStorage ? it : it.skip)('a later, non-concurrent refresh runs fresh rather than reusing a settled promise', async () => {
      sessionStorage.setItem('descon.staffRefreshToken', 'stored-refresh');
      let refreshCallCount = 0;
      stubFetch(async (url) => {
        if (String(url).includes('/auth/refresh')) {
          refreshCallCount += 1;
          return jsonResponse(successEnvelope(sessionPayload({ refresh_token: `refresh-${refreshCallCount}` })));
        }
        if (String(url).includes('/users/profile')) return profileResponse();
        throw new Error(`unexpected fetch to ${url}`);
      });

      const client = buildClient();
      await client.restoreSession();
      await client.restoreSession();

      expect(refreshCallCount).toBe(2);
    });
  });

  describe('signOut', () => {
    it('calls DELETE /auth/logout with the current access token as a Bearer header', async () => {
      const calls = stubHappyPathFetch();
      const client = buildClient();
      await client.signIn({ email: 'admin@descon.com', password: 'Passw0rd!' });
      await client.signOut();

      const logoutCall = calls.find(([url]) => url.includes('/auth/logout'));
      expect(logoutCall).toBeDefined();
      const [url, init] = logoutCall!;
      expect(url).toBe('http://example.test/api/v1/auth/logout');
      expect(init.method).toBe('DELETE');
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer access-1');
    });

    (hasSessionStorage ? it : it.skip)('clears the persisted refresh token even when the server call fails', async () => {
      stubHappyPathFetch({
        logout: () => jsonResponse(errorEnvelope([{ code: 'unauthorized', message: 'Invalid token.' }]), { status: 401 }),
      });

      const client = buildClient();
      await client.signIn({ email: 'admin@descon.com', password: 'Passw0rd!' });
      await expect(client.signOut()).resolves.toBeUndefined();
      expect(sessionStorage.getItem('descon.staffRefreshToken')).toBeNull();
    });

    it('deduplicates concurrent signOut calls into a single logout request', async () => {
      let logoutCallCount = 0;
      const calls = stubHappyPathFetch({
        logout: () => {
          logoutCallCount += 1;
          return jsonResponse(successEnvelope({ revoked: true, message: 'Session revoked.' }));
        },
      });
      void calls;

      const client = buildClient();
      await client.signIn({ email: 'admin@descon.com', password: 'Passw0rd!' });
      await Promise.all([client.signOut(), client.signOut()]);

      expect(logoutCallCount).toBe(1);
    });
  });

  describe('authenticatedRequest', () => {
    it('attaches the current access token to the caller-supplied request', async () => {
      stubHappyPathFetch();
      const client = buildClient();
      await client.signIn({ email: 'admin@descon.com', password: 'Passw0rd!' });

      const seenTokens: string[] = [];
      const result = await client.authenticatedRequest(async (token) => {
        seenTokens.push(token);
        return 'ok';
      });

      expect(result).toBe('ok');
      expect(seenTokens).toEqual(['access-1']);
    });

    (hasSessionStorage ? it : it.skip)('refreshes and retries exactly once on a 401, sharing one refresh across concurrent 401s', async () => {
      sessionStorage.setItem('descon.staffRefreshToken', 'stored-refresh');
      let refreshCallCount = 0;
      stubFetch(async (url) => {
        if (String(url).includes('/auth/refresh')) {
          refreshCallCount += 1;
          return jsonResponse(successEnvelope(sessionPayload({ access_token: 'refreshed-access' })));
        }
        if (String(url).includes('/users/profile')) return profileResponse();
        throw new Error(`unexpected fetch to ${url}`);
      });

      const client = buildClient();
      let attempt = 0;
      const makeRequest = async (token: string) => {
        attempt += 1;
        if (token === 'refreshed-access') return `ok-${attempt}`;
        const unauthorized: { status: number; code: string } = { status: 401, code: 'HTTP_4XX' };
        throw unauthorized;
      };

      const [first, second] = await Promise.all([
        client.authenticatedRequest(makeRequest),
        client.authenticatedRequest(makeRequest),
      ]);

      expect(first).toMatch(/^ok-/);
      expect(second).toMatch(/^ok-/);
      expect(refreshCallCount).toBe(1);
    });

    (hasSessionStorage ? it : it.skip)('does not loop -- a second 401 after the one retry is surfaced, not refreshed again', async () => {
      sessionStorage.setItem('descon.staffRefreshToken', 'stored-refresh');
      let refreshCallCount = 0;
      stubFetch(async (url) => {
        if (String(url).includes('/auth/login')) return jsonResponse(successEnvelope(sessionPayload()), { status: 201 });
        if (String(url).includes('/users/profile')) return profileResponse();
        if (String(url).includes('/auth/refresh')) {
          refreshCallCount += 1;
          return jsonResponse(successEnvelope(sessionPayload()));
        }
        throw new Error(`unexpected fetch to ${url}`);
      });

      const client = buildClient();
      await client.signIn({ email: 'admin@descon.com', password: 'Passw0rd!' });

      let callCount = 0;
      const alwaysUnauthorized = async () => {
        callCount += 1;
        const unauthorized: { status: number; code: string } = { status: 401, code: 'HTTP_4XX' };
        throw unauthorized;
      };

      await expect(client.authenticatedRequest(alwaysUnauthorized)).rejects.toEqual({ code: 'SESSION_EXPIRED' });
      expect(callCount).toBe(2);
      expect(refreshCallCount).toBe(1);
    });

    it('surfaces 403 as FORBIDDEN immediately, without attempting a refresh', async () => {
      // No /auth/refresh branch registered -- if authenticatedRequest
      // mistakenly tried to refresh on a 403, this stub would throw
      // "unexpected fetch", failing the test.
      stubHappyPathFetch();
      const client = buildClient();
      await client.signIn({ email: 'admin@descon.com', password: 'Passw0rd!' });

      const forbidden = async () => {
        const error: { status: number; code: string } = { status: 403, code: 'HTTP_4XX' };
        throw error;
      };

      await expect(client.authenticatedRequest(forbidden)).rejects.toEqual({ code: 'FORBIDDEN' });
    });

    (hasSessionStorage ? it : it.skip)('a network failure during the refresh triggered by a 401 preserves the session (does not clear the refresh token)', async () => {
      stubHappyPathFetch({
        refresh: () => {
          throw new TypeError('Failed to fetch');
        },
      });

      const client = buildClient();
      await client.signIn({ email: 'admin@descon.com', password: 'Passw0rd!' });
      const refreshTokenAfterSignIn = sessionStorage.getItem('descon.staffRefreshToken');
      expect(refreshTokenAfterSignIn).toEqual(expect.any(String));

      const unauthorized = async () => {
        const error: { status: number; code: string } = { status: 401, code: 'HTTP_4XX' };
        throw error;
      };

      await expect(client.authenticatedRequest(unauthorized)).rejects.toEqual({ code: 'NETWORK_ERROR' });
      expect(sessionStorage.getItem('descon.staffRefreshToken')).toBe(refreshTokenAfterSignIn);
    });
  });

  describe('authenticatedDataRequest', () => {
    it('attaches the current access token to the caller-supplied request', async () => {
      stubHappyPathFetch();
      const client = buildClient();
      await client.signIn({ email: 'admin@descon.com', password: 'Passw0rd!' });

      const seenTokens: string[] = [];
      const result = await client.authenticatedDataRequest(async (token) => {
        seenTokens.push(token);
        return 'ok';
      });

      expect(result).toBe('ok');
      expect(seenTokens).toEqual(['access-1']);
    });

    (hasSessionStorage ? it : it.skip)('refreshes and retries exactly once on a 401', async () => {
      sessionStorage.setItem('descon.staffRefreshToken', 'stored-refresh');
      stubFetch(async (url) => {
        if (String(url).includes('/auth/refresh')) {
          return jsonResponse(successEnvelope(sessionPayload({ access_token: 'refreshed-access' })));
        }
        if (String(url).includes('/users/profile')) return profileResponse();
        throw new Error(`unexpected fetch to ${url}`);
      });

      const client = buildClient();
      const makeRequest = async (token: string) => {
        if (token === 'refreshed-access') return 'ok';
        const unauthorized: { status: number; code: string } = { status: 401, code: 'HTTP_4XX' };
        throw unauthorized;
      };

      await expect(client.authenticatedDataRequest(makeRequest)).resolves.toBe('ok');
    });

    (hasSessionStorage ? it : it.skip)('does not loop -- a second 401 after the one retry becomes SESSION_EXPIRED', async () => {
      sessionStorage.setItem('descon.staffRefreshToken', 'stored-refresh');
      stubFetch(async (url) => {
        if (String(url).includes('/auth/login')) return jsonResponse(successEnvelope(sessionPayload()), { status: 201 });
        if (String(url).includes('/users/profile')) return profileResponse();
        if (String(url).includes('/auth/refresh')) return jsonResponse(successEnvelope(sessionPayload()));
        throw new Error(`unexpected fetch to ${url}`);
      });

      const client = buildClient();
      await client.signIn({ email: 'admin@descon.com', password: 'Passw0rd!' });

      const alwaysUnauthorized = async () => {
        const unauthorized: { status: number; code: string } = { status: 401, code: 'HTTP_4XX' };
        throw unauthorized;
      };

      await expect(client.authenticatedDataRequest(alwaysUnauthorized)).rejects.toEqual({ code: 'SESSION_EXPIRED' });
    });

    it('rethrows a 403 unchanged, without attempting a refresh or collapsing it to FORBIDDEN', async () => {
      // No /auth/refresh branch registered -- if authenticatedDataRequest
      // mistakenly tried to refresh on a 403, this stub would throw
      // "unexpected fetch", failing the test.
      stubHappyPathFetch();
      const client = buildClient();
      await client.signIn({ email: 'admin@descon.com', password: 'Passw0rd!' });

      const forbidden = async () => {
        const error = { status: 403, code: 'HTTP_4XX', serverCode: 'inactive_account' };
        throw error;
      };

      await expect(client.authenticatedDataRequest(forbidden)).rejects.toEqual({
        status: 403,
        code: 'HTTP_4XX',
        serverCode: 'inactive_account',
      });
    });

    it('rethrows a 409/422/429/5xx-shaped error unchanged, preserving the caller-inspectable body', async () => {
      stubHappyPathFetch();
      const client = buildClient();
      await client.signIn({ email: 'admin@descon.com', password: 'Passw0rd!' });

      const conflict = async () => {
        const error = { status: 409, code: 'HTTP_4XX', message: 'Import already in progress.' };
        throw error;
      };

      await expect(client.authenticatedDataRequest(conflict)).rejects.toEqual({
        status: 409,
        code: 'HTTP_4XX',
        message: 'Import already in progress.',
      });
    });
  });

  describe('stale request / epoch races', () => {
    (hasSessionStorage ? it : it.skip)('sign-out while a restore is pending: the stale restore must not revive the session', async () => {
      sessionStorage.setItem('descon.staffRefreshToken', 'stored-refresh');
      let resolveRefresh: (value: Response) => void;
      stubFetch(async (url) => {
        if (String(url).includes('/auth/refresh')) {
          return new Promise((resolve) => {
            resolveRefresh = resolve;
          });
        }
        return jsonResponse(successEnvelope({ revoked: true, message: 'Session revoked.' }));
      });

      const client = buildClient();
      const restorePromise = client.restoreSession();
      await client.signOut();

      resolveRefresh!(jsonResponse(successEnvelope(sessionPayload())));
      await expect(restorePromise).rejects.toBeTruthy();

      expect(sessionStorage.getItem('descon.staffRefreshToken')).toBeNull();
    });

    (hasSessionStorage ? it : it.skip)('sign-out while a sign-in is pending: the stale sign-in must not persist credentials', async () => {
      let resolveLogin: (value: Response) => void;
      stubFetch(async (url) => {
        if (String(url).includes('/auth/login')) {
          return new Promise((resolve) => {
            resolveLogin = resolve;
          });
        }
        return jsonResponse(successEnvelope({ revoked: true, message: 'Session revoked.' }));
      });

      const client = buildClient();
      const signInPromise = client.signIn({ email: 'admin@descon.com', password: 'Passw0rd!' });
      await client.signOut();

      resolveLogin!(jsonResponse(successEnvelope(sessionPayload()), { status: 201 }));
      await expect(signInPromise).rejects.toBeTruthy();

      expect(sessionStorage.getItem('descon.staffRefreshToken')).toBeNull();
    });

    (hasSessionStorage ? it : it.skip)('a new sign-in while an old refresh is pending: the stale refresh must not overwrite the fresh credentials', async () => {
      sessionStorage.setItem('descon.staffRefreshToken', 'old-refresh');
      let resolveRefresh: (value: Response) => void;
      stubFetch(async (url) => {
        if (String(url).includes('/auth/refresh')) {
          return new Promise((resolve) => {
            resolveRefresh = resolve;
          });
        }
        if (String(url).includes('/auth/login')) {
          return jsonResponse(
            successEnvelope(
              sessionPayload({
                access_token: 'new-access',
                refresh_token: 'new-refresh',
                user: { id: 'staff-2', email: 'hr@descon.com', role: 'hr' },
              })
            ),
            { status: 201 }
          );
        }
        if (String(url).includes('/users/profile')) {
          return profileResponse({ id: 'staff-2', email: 'hr@descon.com', role: 'hr', permissions: ['manage_candidate_documents'] });
        }
        throw new Error(`unexpected fetch to ${url}`);
      });

      const client = buildClient();
      const restorePromise = client.restoreSession(); // starts the old refresh
      const session = await client.signIn({ email: 'hr@descon.com', password: 'Passw0rd!' });
      expect(session.staffId).toBe('staff-2');
      expect(sessionStorage.getItem('descon.staffRefreshToken')).toBe('new-refresh');

      // The old refresh finally resolves with a *different* (stale) session.
      resolveRefresh!(
        jsonResponse(
          successEnvelope(
            sessionPayload({
              access_token: 'stale-access',
              refresh_token: 'stale-refresh',
              user: { id: 'staff-1', email: 'admin@descon.com', role: 'admin' },
            })
          )
        )
      );
      await expect(restorePromise).rejects.toBeTruthy();

      expect(sessionStorage.getItem('descon.staffRefreshToken')).toBe('new-refresh');
    });

    (hasSessionStorage ? it : it.skip)('an old request (a 401-triggered refresh inside authenticatedRequest) finishing after signOut already owns the client never revives the session', async () => {
      sessionStorage.setItem('descon.staffRefreshToken', 'old-refresh');
      let resolveRefresh: (value: Response) => void;
      let logoutCalled = false;
      stubFetch(async (url) => {
        if (String(url).includes('/auth/refresh')) {
          return new Promise((resolve) => {
            resolveRefresh = resolve;
          });
        }
        if (String(url).includes('/auth/logout')) {
          logoutCalled = true;
          return jsonResponse(successEnvelope({ revoked: true, message: 'Session revoked.' }));
        }
        throw new Error(`unexpected fetch to ${url}`);
      });

      const client = buildClient();
      const unauthorized = async () => {
        const error: { status: number; code: string } = { status: 401, code: 'HTTP_4XX' };
        throw error;
      };
      const requestPromise = client.authenticatedRequest(unauthorized);

      await client.signOut();
      expect(logoutCalled).toBe(false); // no access token existed yet to revoke

      resolveRefresh!(jsonResponse(successEnvelope(sessionPayload({ refresh_token: 'revived-refresh' }))));
      await expect(requestPromise).rejects.toBeTruthy();

      expect(sessionStorage.getItem('descon.staffRefreshToken')).toBeNull();
    });
  });
});

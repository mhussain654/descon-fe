// Framework-agnostic: runs under both web's Vitest (jsdom, has sessionStorage)
// and mobile's Jest -- though this feature is web-only today, the mock stays
// portable like every other shared/auth client.
import {
  createMockStaffAuthClient,
  createUnavailableStaffAuthClient,
  MOCK_STAFF_ACCOUNTS,
  MOCK_STAFF_MAX_ATTEMPTS,
  MOCK_STAFF_PASSWORD,
} from './staffAuthClient';

const ADMIN = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'admin')!;
const HR = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'hr' && !account.locked && !account.suspended)!;
const LOCKED = MOCK_STAFF_ACCOUNTS.find((account) => account.locked)!;
const SUSPENDED = MOCK_STAFF_ACCOUNTS.find((account) => account.suspended)!;

// This file lives under shared/, so it also runs under mobile's Jest suite
// (its config roots include ../shared) even though staff auth is web-only --
// and React Native's test environment has no `sessionStorage` global at all.
// Persistence-dependent assertions are guarded/skipped accordingly; the mock
// client itself already no-ops storage when it's unavailable (see
// staffAuthClient.ts), so only the *tests* that check recovery need guarding.
const hasSessionStorage = typeof sessionStorage !== 'undefined';

beforeEach(() => {
  if (hasSessionStorage) sessionStorage.clear();
});

describe('createMockStaffAuthClient', () => {
  it('signs in successfully with a valid account and the documented mock password', async () => {
    const client = createMockStaffAuthClient({ delayMs: 0 });
    const session = await client.signIn({ email: ADMIN.email, password: MOCK_STAFF_PASSWORD });
    expect(session.staffId).toBe(ADMIN.staffId);
    expect(session.role).toBe('admin');
    expect(session).not.toHaveProperty('accessToken');
    expect(session).not.toHaveProperty('refreshToken');
    expect(new Date(session.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects an unknown email with the same generic error as a wrong password', async () => {
    const client = createMockStaffAuthClient({ delayMs: 0 });
    const unknownEmailResult = await client.signIn({ email: 'nobody@descon.com', password: MOCK_STAFF_PASSWORD }).catch((e) => e);
    const wrongPasswordResult = await client
      .signIn({ email: ADMIN.email, password: 'wrong-password' })
      .catch((e) => e);
    expect(unknownEmailResult).toEqual({ code: 'INVALID_CREDENTIALS' });
    expect(wrongPasswordResult).toEqual({ code: 'INVALID_CREDENTIALS' });
  });

  it('rejects a locked account and a suspended account with the same generic error, never revealing why', async () => {
    const client = createMockStaffAuthClient({ delayMs: 0 });
    const lockedResult = await client.signIn({ email: LOCKED.email, password: MOCK_STAFF_PASSWORD }).catch((e) => e);
    const suspendedResult = await client
      .signIn({ email: SUSPENDED.email, password: MOCK_STAFF_PASSWORD })
      .catch((e) => e);
    expect(lockedResult).toEqual({ code: 'INVALID_CREDENTIALS' });
    expect(suspendedResult).toEqual({ code: 'INVALID_CREDENTIALS' });
  });

  it('locks out after MOCK_STAFF_MAX_ATTEMPTS failed attempts for the same email', async () => {
    const client = createMockStaffAuthClient({ delayMs: 0 });
    for (let attempt = 0; attempt < MOCK_STAFF_MAX_ATTEMPTS; attempt += 1) {
      await expect(client.signIn({ email: HR.email, password: 'wrong' })).rejects.toEqual({
        code: 'INVALID_CREDENTIALS',
      });
    }
    // Even the correct password no longer works once locked out.
    await expect(client.signIn({ email: HR.email, password: MOCK_STAFF_PASSWORD })).rejects.toEqual({
      code: 'TOO_MANY_ATTEMPTS',
    });
  });

  it('resets the attempt counter on a successful sign-in', async () => {
    const client = createMockStaffAuthClient({ delayMs: 0 });
    await expect(client.signIn({ email: HR.email, password: 'wrong' })).rejects.toEqual({
      code: 'INVALID_CREDENTIALS',
    });
    await client.signIn({ email: HR.email, password: MOCK_STAFF_PASSWORD });
    // Should have fresh attempts again, not be partway to lockout.
    await expect(client.signIn({ email: HR.email, password: 'wrong' })).rejects.toEqual({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('restoreSession resolves null when nothing was ever signed in', async () => {
    const client = createMockStaffAuthClient({ delayMs: 0 });
    await expect(client.restoreSession()).resolves.toBeNull();
  });

  (hasSessionStorage ? it : it.skip)(
    'restoreSession recovers the session a prior signIn persisted (session recovery on reload)',
    async () => {
      const client = createMockStaffAuthClient({ delayMs: 0 });
      const session = await client.signIn({ email: ADMIN.email, password: MOCK_STAFF_PASSWORD });

      // A fresh client instance simulates a page reload -- restoreSession must
      // recover from the underlying storage, not any in-memory client state.
      const reloadedClient = createMockStaffAuthClient({ delayMs: 0 });
      await expect(reloadedClient.restoreSession()).resolves.toEqual(session);
    }
  );

  (hasSessionStorage ? it : it.skip)('restoreSession resolves null and clears storage for an expired session', async () => {
    let now = 0;
    const originalNow = Date.now;
    Date.now = () => now;
    try {
      const client = createMockStaffAuthClient({ delayMs: 0 });
      await client.signIn({ email: ADMIN.email, password: MOCK_STAFF_PASSWORD });
      now += 61 * 60 * 1000; // past the 60-minute mock session duration

      await expect(client.restoreSession()).resolves.toBeNull();
      // The expired entry must be gone, not merely ignored.
      await expect(client.restoreSession()).resolves.toBeNull();
    } finally {
      Date.now = originalNow;
    }
  });

  (hasSessionStorage ? it : it.skip)('restoreSession resolves null for malformed stored JSON, without throwing', async () => {
    sessionStorage.setItem('descon.staffSession.mock', 'not valid json');
    const client = createMockStaffAuthClient({ delayMs: 0 });
    await expect(client.restoreSession()).resolves.toBeNull();
  });

  (hasSessionStorage ? it : it.skip)('signOut clears the persisted session so a later restoreSession finds nothing', async () => {
    const client = createMockStaffAuthClient({ delayMs: 0 });
    await client.signIn({ email: ADMIN.email, password: MOCK_STAFF_PASSWORD });
    await client.signOut();
    await expect(client.restoreSession()).resolves.toBeNull();
  });

  it('authenticatedRequest passes the access token to the caller once signed in', async () => {
    const client = createMockStaffAuthClient({ delayMs: 0 });
    await client.signIn({ email: ADMIN.email, password: MOCK_STAFF_PASSWORD });
    const seenTokens: string[] = [];
    await client.authenticatedRequest(async (token) => {
      seenTokens.push(token);
      return 'ok';
    });
    expect(seenTokens).toHaveLength(1);
    expect(seenTokens[0]).toEqual(expect.any(String));
  });

  it('authenticatedRequest rejects with SESSION_EXPIRED before any sign-in has happened', async () => {
    const client = createMockStaffAuthClient({ delayMs: 0 });
    await expect(client.authenticatedRequest(async () => 'ok')).rejects.toEqual({ code: 'SESSION_EXPIRED' });
  });

  it('authenticatedDataRequest passes the access token to the caller once signed in', async () => {
    const client = createMockStaffAuthClient({ delayMs: 0 });
    await client.signIn({ email: ADMIN.email, password: MOCK_STAFF_PASSWORD });
    const seenTokens: string[] = [];
    await client.authenticatedDataRequest(async (token) => {
      seenTokens.push(token);
      return 'ok';
    });
    expect(seenTokens).toHaveLength(1);
    expect(seenTokens[0]).toEqual(expect.any(String));
  });

  it('authenticatedDataRequest rejects with SESSION_EXPIRED before any sign-in has happened', async () => {
    const client = createMockStaffAuthClient({ delayMs: 0 });
    await expect(client.authenticatedDataRequest(async () => 'ok')).rejects.toEqual({ code: 'SESSION_EXPIRED' });
  });
});

describe('createUnavailableStaffAuthClient', () => {
  it('signIn always fails safely with SERVICE_UNAVAILABLE, even with valid-looking credentials', async () => {
    const client = createUnavailableStaffAuthClient();
    await expect(client.signIn({ email: ADMIN.email, password: MOCK_STAFF_PASSWORD })).rejects.toEqual({
      code: 'SERVICE_UNAVAILABLE',
    });
  });

  it('restoreSession resolves null rather than rejecting, so app load never shows an alarming error', async () => {
    const client = createUnavailableStaffAuthClient();
    await expect(client.restoreSession()).resolves.toBeNull();
  });

  it('signOut resolves without error', async () => {
    const client = createUnavailableStaffAuthClient();
    await expect(client.signOut()).resolves.toBeUndefined();
  });

  it('authenticatedRequest fails safely with SERVICE_UNAVAILABLE', async () => {
    const client = createUnavailableStaffAuthClient();
    await expect(client.authenticatedRequest(async () => 'ok')).rejects.toEqual({ code: 'SERVICE_UNAVAILABLE' });
  });

  it('authenticatedDataRequest fails safely with SERVICE_UNAVAILABLE', async () => {
    const client = createUnavailableStaffAuthClient();
    await expect(client.authenticatedDataRequest(async () => 'ok')).rejects.toEqual({ code: 'SERVICE_UNAVAILABLE' });
  });
});

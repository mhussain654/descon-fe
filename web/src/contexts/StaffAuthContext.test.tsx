import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from '../../../shared/auth/staffAuthClient';
import type { StaffAuthClient, StaffSession } from '../../../shared/auth/staffTypes';
import { StaffAuthProvider, useStaffAuth } from './StaffAuthContext';

const ADMIN = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'admin')!;

function buildSession(overrides: Partial<StaffSession> = {}): StaffSession {
  return {
    staffId: 'staff_1',
    email: 'test@descon.com',
    role: 'admin',
    permissions: ['manage_staff_users'],
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    ...overrides,
  };
}

/** A hand-rolled fake -- gives tests full control over restoreSession()'s timing/outcome, which the mock client can't (it never fails, and its restoreSession() only ever reflects its own sessionStorage, not a session set via a bare login()). */
function buildFakeClient(overrides: Partial<StaffAuthClient> = {}): StaffAuthClient {
  return {
    signIn: vi.fn(),
    restoreSession: vi.fn().mockResolvedValue(null),
    signOut: vi.fn().mockResolvedValue(undefined),
    authenticatedRequest: vi.fn(),
    ...overrides,
  };
}

function Probe() {
  const { status, session, login, signOut, retryRestore, sessionExpired } = useStaffAuth();
  return (
    <div>
      <span>status:{status}</span>
      <span>expired:{String(sessionExpired)}</span>
      <span>staff:{session?.staffId ?? 'none'}</span>
      <span>role:{session?.role ?? 'none'}</span>
      <button type="button" onClick={() => login(buildSession({ staffId: 'staff_manual', role: 'admin' }))}>
        login
      </button>
      <button type="button" onClick={() => login(buildSession({ staffId: 'staff_short', expiresAt: new Date(Date.now() + 1000).toISOString() }))}>
        login-short
      </button>
      <button type="button" onClick={() => login(buildSession({ staffId: 'staff_hr', role: 'hr' }))}>
        login-hr
      </button>
      <button type="button" onClick={() => signOut()}>
        signOut
      </button>
      <button type="button" onClick={() => retryRestore()}>
        retryRestore
      </button>
    </div>
  );
}

function renderWithProviders(client: StaffAuthClient = createMockStaffAuthClient({ delayMs: 0 })) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <StaffAuthProvider client={client}>
          <Probe />
        </StaffAuthProvider>
      </QueryClientProvider>
    ),
    queryClient,
    client,
  };
}

describe('StaffAuthProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
  });

  // The mount effect's restoreSession() resolves via a plain microtask (no
  // real timer, given delayMs:0), but Vitest's fake timers make Testing
  // Library's `waitFor` polling unreliable for that transition -- an `act`
  // wrapping a single microtask tick flushes it deterministically instead,
  // without needing real/fake timers at all.
  async function flushRestore() {
    await act(async () => {
      await Promise.resolve();
    });
  }

  it('starts as "restoring" and resolves to unauthenticated once restoreSession finds nothing', async () => {
    renderWithProviders();
    expect(screen.getByText('status:restoring')).toBeInTheDocument();
    await flushRestore();
    expect(screen.getByText('status:unauthenticated')).toBeInTheDocument();
    expect(screen.getByText('staff:none')).toBeInTheDocument();
  });

  it('resolves to authenticated on mount when restoreSession recovers a prior session', async () => {
    const client = createMockStaffAuthClient({ delayMs: 0 });
    await client.signIn({ email: ADMIN.email, password: MOCK_STAFF_PASSWORD });

    renderWithProviders(client);
    await flushRestore();
    expect(screen.getByText('status:authenticated')).toBeInTheDocument();
    expect(screen.getByText(`staff:${ADMIN.staffId}`)).toBeInTheDocument();
  });

  it('becomes authenticated once login() is called with a valid session', async () => {
    renderWithProviders();
    await flushRestore();
    expect(screen.getByText('status:unauthenticated')).toBeInTheDocument();

    act(() => screen.getByRole('button', { name: 'login' }).click());
    expect(screen.getByText('status:authenticated')).toBeInTheDocument();
    expect(screen.getByText('staff:staff_manual')).toBeInTheDocument();
  });

  it('exposes the authenticated role from the session, for consumers to gate nav/actions on', async () => {
    renderWithProviders();
    await flushRestore();
    expect(screen.getByText('status:unauthenticated')).toBeInTheDocument();
    expect(screen.getByText('role:none')).toBeInTheDocument();

    act(() => screen.getByRole('button', { name: 'login' }).click());
    expect(screen.getByText('role:admin')).toBeInTheDocument();
  });

  it('reflects a non-admin role just as faithfully', async () => {
    renderWithProviders();
    await flushRestore();
    expect(screen.getByText('status:unauthenticated')).toBeInTheDocument();

    act(() => screen.getByRole('button', { name: 'login-hr' }).click());
    expect(screen.getByText('role:hr')).toBeInTheDocument();
  });

  it('clears the session, secure storage, and the query cache on manual sign-out (async, awaited, not fire-and-forget)', async () => {
    const client = createMockStaffAuthClient({ delayMs: 0 });
    const signOutSpy = vi.spyOn(client, 'signOut');
    const { queryClient } = renderWithProviders(client);
    const clearSpy = vi.spyOn(queryClient, 'clear');
    await flushRestore();
    expect(screen.getByText('status:unauthenticated')).toBeInTheDocument();

    act(() => screen.getByRole('button', { name: 'login' }).click());
    await act(async () => {
      screen.getByRole('button', { name: 'signOut' }).click();
      await Promise.resolve();
    });

    expect(screen.getByText('status:unauthenticated')).toBeInTheDocument();
    expect(screen.getByText('expired:false')).toBeInTheDocument();
    expect(clearSpy).toHaveBeenCalled();
    expect(signOutSpy).toHaveBeenCalled();
  });

  it('throws when useStaffAuth is used outside StaffAuthProvider', () => {
    function Bare() {
      useStaffAuth();
      return null;
    }
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Bare />)).toThrow('useStaffAuth must be used within StaffAuthProvider');
    consoleError.mockRestore();
  });

  describe('proactive pre-expiry refresh (not an immediate logout on access-token expiry)', () => {
    it('refreshes before expiry and keeps the session authenticated when restoreSession confirms it is still valid', async () => {
      const refreshedSession = buildSession({ staffId: 'staff_manual', expiresAt: new Date(Date.now() + 120_000).toISOString() });
      const client = buildFakeClient({ restoreSession: vi.fn().mockResolvedValue(refreshedSession) });
      renderWithProviders(client);
      await flushRestore();

      act(() => screen.getByRole('button', { name: 'login' }).click());
      expect(screen.getByText('status:authenticated')).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      // Still authenticated -- the short-lived access token "expiring" on
      // its own is not what ends the session; only a confirmed invalid
      // refresh does.
      expect(screen.getByText('status:authenticated')).toBeInTheDocument();
      expect(screen.getByText('expired:false')).toBeInTheDocument();
    });

    it('signs out only once restoreSession confirms the refresh token is truly invalid/expired/revoked (resolves null)', async () => {
      const client = buildFakeClient({ restoreSession: vi.fn().mockResolvedValue(null) });
      renderWithProviders(client);
      await flushRestore();

      act(() => screen.getByRole('button', { name: 'login-short' }).click());
      expect(screen.getByText('status:authenticated')).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(6000);
      });

      expect(screen.getByText('status:unauthenticated')).toBeInTheDocument();
      expect(screen.getByText('expired:true')).toBeInTheDocument();
    });

    it('preserves the session across a transient network/offline failure during the proactive refresh -- does not log out', async () => {
      const client = buildFakeClient({ restoreSession: vi.fn().mockRejectedValue({ code: 'NETWORK_ERROR' }) });
      renderWithProviders(client);
      await flushRestore();

      act(() => screen.getByRole('button', { name: 'login-short' }).click());
      expect(screen.getByText('status:authenticated')).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(6000);
      });

      // A network hiccup while trying to refresh must not destroy a
      // session that might still be perfectly valid.
      expect(screen.getByText('status:authenticated')).toBeInTheDocument();
      expect(screen.getByText('expired:false')).toBeInTheDocument();
    });
  });

  describe('restore-error status (initial restoration could not confirm a session either way)', () => {
    it('shows restore-error, not unauthenticated, when the initial restoreSession call fails with a network error', async () => {
      const client = buildFakeClient({ restoreSession: vi.fn().mockRejectedValue({ code: 'OFFLINE' }) });
      renderWithProviders(client);
      await flushRestore();

      expect(screen.getByText('status:restore-error')).toBeInTheDocument();
    });

    it('retryRestore() re-attempts restoration and can recover to authenticated', async () => {
      const restoreSession = vi
        .fn()
        .mockRejectedValueOnce({ code: 'OFFLINE' })
        .mockResolvedValueOnce(buildSession({ staffId: 'staff_recovered' }));
      const client = buildFakeClient({ restoreSession });
      renderWithProviders(client);
      await flushRestore();
      expect(screen.getByText('status:restore-error')).toBeInTheDocument();

      await act(async () => {
        screen.getByRole('button', { name: 'retryRestore' }).click();
        await Promise.resolve();
      });

      expect(screen.getByText('status:authenticated')).toBeInTheDocument();
      expect(screen.getByText('staff:staff_recovered')).toBeInTheDocument();
    });
  });

  describe('stale request protection (a newer authoritative action supersedes a pending one)', () => {
    it('a slow initial restoreSession that resolves after a manual login() must not overwrite the fresher, authenticated state', async () => {
      let resolveRestore: (value: StaffSession | null) => void;
      const client = buildFakeClient({
        restoreSession: vi.fn(
          () =>
            new Promise((resolve) => {
              resolveRestore = resolve;
            })
        ),
      });
      renderWithProviders(client);
      expect(screen.getByText('status:restoring')).toBeInTheDocument();

      // The candidate logs in manually (e.g. via the sign-in form) before
      // the slow initial restore has resolved.
      act(() => screen.getByRole('button', { name: 'login' }).click());
      expect(screen.getByText('status:authenticated')).toBeInTheDocument();
      expect(screen.getByText('staff:staff_manual')).toBeInTheDocument();

      // The stale restore now resolves with a *different* session.
      await act(async () => {
        resolveRestore!(buildSession({ staffId: 'staff_stale' }));
        await Promise.resolve();
      });

      // The fresh login must still be in effect.
      expect(screen.getByText('status:authenticated')).toBeInTheDocument();
      expect(screen.getByText('staff:staff_manual')).toBeInTheDocument();
    });

    it('a slow initial restoreSession that resolves after signOut() must not revive the session', async () => {
      let resolveRestore: (value: StaffSession | null) => void;
      const client = buildFakeClient({
        restoreSession: vi.fn(
          () =>
            new Promise((resolve) => {
              resolveRestore = resolve;
            })
        ),
      });
      renderWithProviders(client);
      expect(screen.getByText('status:restoring')).toBeInTheDocument();

      await act(async () => {
        screen.getByRole('button', { name: 'signOut' }).click();
        await Promise.resolve();
      });
      expect(screen.getByText('status:unauthenticated')).toBeInTheDocument();

      await act(async () => {
        resolveRestore!(buildSession({ staffId: 'staff_stale' }));
        await Promise.resolve();
      });

      expect(screen.getByText('status:unauthenticated')).toBeInTheDocument();
      expect(screen.getByText('staff:none')).toBeInTheDocument();
    });
  });
});

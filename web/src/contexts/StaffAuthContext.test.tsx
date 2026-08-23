import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from '../../../shared/auth/staffAuthClient';
import type { StaffSession } from '../../../shared/auth/staffTypes';
import { StaffAuthProvider, useStaffAuth } from './StaffAuthContext';

const ADMIN = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'admin')!;
const VIEWER = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'viewer' && !account.locked && !account.suspended)!;

function buildSession(overrides: Partial<StaffSession> = {}): StaffSession {
  return {
    accessToken: 'token',
    staffId: 'staff_1',
    name: 'Test Staff',
    email: 'test@descon.com',
    role: 'admin',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    ...overrides,
  };
}

function Probe() {
  const { status, session, login, signOut, hasPermission, sessionExpired } = useStaffAuth();
  return (
    <div>
      <span>status:{status}</span>
      <span>expired:{String(sessionExpired)}</span>
      <span>staff:{session?.staffId ?? 'none'}</span>
      <span>canManageStaff:{String(hasPermission('canManageStaff'))}</span>
      <button type="button" onClick={() => login(buildSession({ staffId: 'staff_manual', role: 'admin' }))}>
        login
      </button>
      <button type="button" onClick={() => login(buildSession({ staffId: 'staff_short', expiresAt: new Date(Date.now() + 1000).toISOString() }))}>
        login-short
      </button>
      <button type="button" onClick={() => login(buildSession({ staffId: 'staff_viewer', role: 'viewer' }))}>
        login-viewer
      </button>
      <button type="button" onClick={() => signOut()}>
        signOut
      </button>
    </div>
  );
}

function renderWithProviders(client = createMockStaffAuthClient({ delayMs: 0 })) {
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

  it('derives hasPermission from the session role', async () => {
    renderWithProviders();
    await flushRestore();
    expect(screen.getByText('status:unauthenticated')).toBeInTheDocument();

    expect(screen.getByText('canManageStaff:false')).toBeInTheDocument();

    act(() => screen.getByRole('button', { name: 'login' }).click());
    expect(screen.getByText('canManageStaff:true')).toBeInTheDocument();
  });

  it('a viewer role never has canManageStaff', async () => {
    renderWithProviders();
    await flushRestore();
    expect(screen.getByText('status:unauthenticated')).toBeInTheDocument();

    act(() => screen.getByRole('button', { name: 'login-viewer' }).click());
    expect(screen.getByText('canManageStaff:false')).toBeInTheDocument();
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

  it('detects the session going stale while the app is open and flags it as an expiry', async () => {
    renderWithProviders();
    await flushRestore();
    expect(screen.getByText('status:unauthenticated')).toBeInTheDocument();

    act(() => screen.getByRole('button', { name: 'login-short' }).click());
    expect(screen.getByText('status:authenticated')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });

    expect(screen.getByText('status:unauthenticated')).toBeInTheDocument();
    expect(screen.getByText('expired:true')).toBeInTheDocument();
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
});

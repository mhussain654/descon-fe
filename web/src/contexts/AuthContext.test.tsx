import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';

function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>), queryClient };
}

function Probe() {
  const { status, session, login, logout, sessionExpired } = useAuth();
  return (
    <div>
      <span>status:{status}</span>
      <span>expired:{String(sessionExpired)}</span>
      <span>candidate:{session?.candidateId ?? 'none'}</span>
      <button
        type="button"
        onClick={() =>
          login({
            accessToken: 'token',
            candidateId: 'candidate_1',
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          })
        }
      >
        login
      </button>
      <button
        type="button"
        onClick={() =>
          login({
            accessToken: 'token',
            candidateId: 'candidate_short',
            expiresAt: new Date(Date.now() + 1000).toISOString(),
          })
        }
      >
        login-short
      </button>
      <button type="button" onClick={() => logout()}>
        logout
      </button>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts unauthenticated with no session', () => {
    renderWithProviders(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    expect(screen.getByText('status:unauthenticated')).toBeInTheDocument();
    expect(screen.getByText('candidate:none')).toBeInTheDocument();
  });

  it('becomes authenticated once login() is called with a valid session', () => {
    renderWithProviders(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    act(() => screen.getByRole('button', { name: 'login' }).click());
    expect(screen.getByText('status:authenticated')).toBeInTheDocument();
    expect(screen.getByText('candidate:candidate_1')).toBeInTheDocument();
  });

  it('clears the session and flags a manual logout', () => {
    renderWithProviders(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    act(() => screen.getByRole('button', { name: 'login' }).click());
    act(() => screen.getByRole('button', { name: 'logout' }).click());
    expect(screen.getByText('status:unauthenticated')).toBeInTheDocument();
    expect(screen.getByText('expired:false')).toBeInTheDocument();
  });

  it('clears the TanStack Query cache on logout (AGENTS.md: clear sensitive state and caches on logout)', () => {
    const { queryClient } = renderWithProviders(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    const clearSpy = vi.spyOn(queryClient, 'clear');

    act(() => screen.getByRole('button', { name: 'login' }).click());
    act(() => screen.getByRole('button', { name: 'logout' }).click());

    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('detects the session going stale while the app is open and flags it as an expiry', () => {
    renderWithProviders(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    act(() => screen.getByRole('button', { name: 'login-short' }).click());
    expect(screen.getByText('status:authenticated')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(screen.getByText('status:unauthenticated')).toBeInTheDocument();
    expect(screen.getByText('expired:true')).toBeInTheDocument();
  });

  it('throws when useAuth is used outside AuthProvider', () => {
    function Bare() {
      useAuth();
      return null;
    }
    // Swallow the expected React error-boundary console noise for this one assertion.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Bare />)).toThrow('useAuth must be used within AuthProvider');
    consoleError.mockRestore();
  });
});

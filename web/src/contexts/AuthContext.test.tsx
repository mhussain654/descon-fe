import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';

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
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    expect(screen.getByText('status:unauthenticated')).toBeInTheDocument();
    expect(screen.getByText('candidate:none')).toBeInTheDocument();
  });

  it('becomes authenticated once login() is called with a valid session', () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    act(() => screen.getByRole('button', { name: 'login' }).click());
    expect(screen.getByText('status:authenticated')).toBeInTheDocument();
    expect(screen.getByText('candidate:candidate_1')).toBeInTheDocument();
  });

  it('clears the session and flags a manual logout', () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    act(() => screen.getByRole('button', { name: 'login' }).click());
    act(() => screen.getByRole('button', { name: 'logout' }).click());
    expect(screen.getByText('status:unauthenticated')).toBeInTheDocument();
    expect(screen.getByText('expired:false')).toBeInTheDocument();
  });

  it('detects the session going stale while the app is open and flags it as an expiry', () => {
    render(
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

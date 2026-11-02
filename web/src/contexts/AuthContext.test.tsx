import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthSession, CandidateAuthClient } from '../../../shared/auth/types';
import { AuthProvider, useAuth } from './AuthContext';

function stubClient(refreshSession: CandidateAuthClient['refreshSession']): CandidateAuthClient {
  return { requestOtp: vi.fn(), resendOtp: vi.fn(), verifyOtp: vi.fn(), refreshSession };
}

const REFRESHED: AuthSession = {
  accessToken: 'token-2',
  refreshToken: 'refresh-2',
  candidateId: 'candidate_refreshed',
  candidateName: 'Ahmed Ali',
  preferredLocale: 'en',
  expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  consent: { currentPolicyVersion: 'v1', accepted: true, acceptedAt: null },
};

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
            refreshToken: 'refresh',
            candidateId: 'candidate_1',
            candidateName: 'Ahmed Ali',
            preferredLocale: 'en',
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
            refreshToken: 'refresh',
            candidateId: 'candidate_short',
            candidateName: 'Ahmed Ali',
            preferredLocale: 'en',
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

  it('stays signed in when the access token lapses while the tab is in the background and renewal is not yet possible', () => {
    renderWithProviders(
      <AuthProvider client={stubClient(() => Promise.reject({ code: 'NETWORK_ERROR' }))}>
        <Probe />
      </AuthProvider>
    );
    act(() => screen.getByRole('button', { name: 'login-short' }).click());
    expect(screen.getByText('status:authenticated')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(screen.getByText('status:authenticated')).toBeInTheDocument();
    expect(screen.getByText('expired:false')).toBeInTheDocument();
  });

  it('renews the session shortly before the access token expires, without a new OTP', async () => {
    const refreshSession = vi.fn().mockResolvedValue(REFRESHED);
    renderWithProviders(
      <AuthProvider client={stubClient(refreshSession)}>
        <Probe />
      </AuthProvider>
    );
    act(() => screen.getByRole('button', { name: 'login-short' }).click());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });

    expect(refreshSession).toHaveBeenCalledWith('refresh');
    expect(screen.getByText('status:authenticated')).toBeInTheDocument();
    expect(screen.getByText('candidate:candidate_refreshed')).toBeInTheDocument();
  });

  it('ends the session as expired when the server rejects the refresh token', async () => {
    const refreshSession = vi.fn().mockRejectedValue({ code: 'SESSION_EXPIRED' });
    renderWithProviders(
      <AuthProvider client={stubClient(refreshSession)}>
        <Probe />
      </AuthProvider>
    );
    act(() => screen.getByRole('button', { name: 'login' }).click());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });

    expect(screen.getByText('status:unauthenticated')).toBeInTheDocument();
    expect(screen.getByText('expired:true')).toBeInTheDocument();
  });

  it('keeps the session and retries when the refresh fails transiently', async () => {
    const refreshSession = vi
      .fn()
      .mockRejectedValueOnce({ code: 'NETWORK_ERROR' })
      .mockResolvedValue(REFRESHED);
    renderWithProviders(
      <AuthProvider client={stubClient(refreshSession)}>
        <Probe />
      </AuthProvider>
    );
    act(() => screen.getByRole('button', { name: 'login' }).click());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(screen.getByText('status:authenticated')).toBeInTheDocument();
    expect(screen.getByText('candidate:candidate_1')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(screen.getByText('candidate:candidate_refreshed')).toBeInTheDocument();
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

describe('getAccessToken', () => {
  function TokenProbe() {
    const { getAccessToken, login, status, sessionExpired } = useAuth();
    const [result, setResult] = useState('idle');
    return (
      <div>
        <span>status:{status}</span>
        <span>expired:{String(sessionExpired)}</span>
        <span>result:{result}</span>
        <button
          type="button"
          onClick={() =>
            login({
              accessToken: 'stale',
              refreshToken: 'refresh',
              candidateId: 'candidate_1',
              candidateName: 'Ahmed Ali',
              preferredLocale: 'en',
              expiresAt: new Date(Date.now() - 1000).toISOString(),
              consent: { currentPolicyVersion: 'v1', accepted: true, acceptedAt: null },
            })
          }
        >
          login-lapsed
        </button>
        <button
          type="button"
          onClick={() =>
            Promise.all([getAccessToken(), getAccessToken()])
              .then((tokens) => setResult(tokens.join(',')))
              .catch((error: { code: string }) => setResult(`error:${error.code}`))
          }
        >
          fetch
        </button>
      </div>
    );
  }

  function renderTokenProbe(refreshSession: CandidateAuthClient['refreshSession']) {
    renderWithProviders(
      <AuthProvider client={stubClient(refreshSession)}>
        <TokenProbe />
      </AuthProvider>
    );
    act(() => screen.getByRole('button', { name: 'login-lapsed' }).click());
    act(() => screen.getByRole('button', { name: 'fetch' }).click());
  }

  it('renews a lapsed token before handing it out, sharing one refresh between parallel requests', async () => {
    const refreshSession = vi.fn().mockResolvedValue(REFRESHED);
    renderTokenProbe(refreshSession);

    expect(await screen.findByText('result:token-2,token-2')).toBeInTheDocument();
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(refreshSession).toHaveBeenCalledWith('refresh');
  });

  it('signs out as expired only when the server rejects the refresh token', async () => {
    renderTokenProbe(() => Promise.reject({ code: 'SESSION_EXPIRED' }));

    expect(await screen.findByText('result:error:SESSION_EXPIRED')).toBeInTheDocument();
    expect(screen.getByText('status:unauthenticated')).toBeInTheDocument();
    expect(screen.getByText('expired:true')).toBeInTheDocument();
  });

  it('rejects with OFFLINE and keeps the candidate signed in when the renewal cannot reach the server', async () => {
    renderTokenProbe(() => Promise.reject({ code: 'OFFLINE' }));

    expect(await screen.findByText('result:error:OFFLINE')).toBeInTheDocument();
    expect(screen.getByText('status:authenticated')).toBeInTheDocument();
  });
});

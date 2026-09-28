import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { isSessionDueForRefresh, isSessionValid } from '../../../shared/auth/session';
import type { AuthSession, CandidateAuthClient, ConsentStatus } from '../../../shared/auth/types';
import { candidateAuthClient } from '../lib/auth-client';

export type AuthStatus = 'unauthenticated' | 'authenticated';
export type LogoutReason = 'manual' | 'expired';

interface AuthContextValue {
  status: AuthStatus;
  session: AuthSession | null;
  /** Set once by the OTP screen on successful verification. */
  login: (session: AuthSession) => void;
  logout: (reason?: LogoutReason) => void;
  /** Updates the current session's consent status in place (MPS-204), e.g. after the candidate accepts on the consent screen. No-op if called with no session. */
  setConsentStatus: (status: ConsentStatus) => void;
  /** True immediately after an expiry-triggered logout; a screen that reads it should also clear it (see `acknowledgeSessionExpired`). */
  sessionExpired: boolean;
  acknowledgeSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const EXPIRY_CHECK_INTERVAL_MS = 5000;

/**
 * Candidate session state. The token lives in memory only -- never
 * localStorage/sessionStorage -- so it can't be read back by an XSS'd
 * script later and doesn't survive a reload (a hard refresh always logs
 * the candidate out on web). This is a deliberate placeholder: the real
 * MPS-201 backend (OTP request/verify, already wired -- see
 * web/src/lib/auth-client.ts) returns the access token in the JSON
 * response body, not a Set-Cookie header. AGENTS.md prefers secure,
 * httpOnly cookie sessions for web; adopting that here needs a backend
 * change (the OTP-verify endpoint setting an httpOnly cookie) that hasn't
 * landed yet. Once that lands, `session` collapses to "ask the server
 * whether the cookie is still valid" rather than holding a token.
 */
export function AuthProvider({
  children,
  client = candidateAuthClient,
}: {
  children: ReactNode;
  client?: CandidateAuthClient;
}) {
  const [session, setSession] = useState<AuthSession | null>(null);
  // Bumped by login/logout so a refresh that was in flight when the session
  // changed can't resurrect (or overwrite) the new state when it resolves.
  const generationRef = useRef(0);
  const refreshInFlightRef = useRef(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const queryClient = useQueryClient();

  const login = useCallback((next: AuthSession) => {
    generationRef.current += 1;
    setSession(next);
    setSessionExpired(false);
  }, []);

  const logout = useCallback(
    (reason: LogoutReason = 'manual') => {
      generationRef.current += 1;
      setSession(null);
      setSessionExpired(reason === 'expired');
      // Candidate-sensitive query data must not survive into whatever the
      // next session on this device is (AGENTS.md: "Clear sensitive state
      // and caches on logout").
      queryClient.clear();
    },
    [queryClient]
  );

  const acknowledgeSessionExpired = useCallback(() => setSessionExpired(false), []);

  const setConsentStatus = useCallback((status: ConsentStatus) => {
    setSession((current) => (current ? { ...current, consent: status } : current));
  }, []);

  // Detects the session going stale while the app is open (not just at
  // request time), so a candidate idling on a protected screen gets moved
  // back to login promptly rather than only on their next action.
  useEffect(() => {
    if (!session) return undefined;
    const interval = setInterval(() => {
      if (!isSessionValid(session)) {
        logout('expired');
      }
    }, EXPIRY_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [session, logout]);

  // Renews the access token shortly before it expires so an active
  // candidate isn't sent back to the OTP screen every few minutes. Only a
  // server-confirmed rejection of the refresh token ends the session; a
  // transient failure (offline, network, rate limit) is retried on the next
  // tick, and the check above still logs out if the token actually lapses.
  useEffect(() => {
    if (!session) return undefined;
    const interval = setInterval(async () => {
      if (refreshInFlightRef.current || !isSessionDueForRefresh(session)) return;

      const generation = generationRef.current;
      refreshInFlightRef.current = true;
      try {
        const refreshed = await client.refreshSession(session.refreshToken);
        if (generationRef.current !== generation) return;
        setSession(refreshed);
      } catch (error) {
        if (generationRef.current === generation && (error as { code?: string })?.code === 'SESSION_EXPIRED') {
          logout('expired');
        }
      } finally {
        refreshInFlightRef.current = false;
      }
    }, EXPIRY_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [session, client, logout]);

  const status: AuthStatus = session && isSessionValid(session) ? 'authenticated' : 'unauthenticated';

  const value = useMemo(
    () => ({ status, session, login, logout, sessionExpired, acknowledgeSessionExpired, setConsentStatus }),
    [status, session, login, logout, sessionExpired, acknowledgeSessionExpired, setConsentStatus]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

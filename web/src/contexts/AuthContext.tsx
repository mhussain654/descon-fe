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
  /**
   * The access token every candidate API call must use. Renews it first when
   * it has expired or is about to (browsers throttle timers in background
   * tabs, so the renewal timer can miss its window), so a request never goes
   * out with a stale token and gets mistaken for an ended session. Rejects
   * with `SESSION_EXPIRED` (after signing out) only when the server rejects
   * the refresh token, and with `OFFLINE`/`NETWORK_ERROR` when the renewal
   * could not reach it.
   */
  getAccessToken: () => Promise<string>;
}

type AccessTokenError = { code: 'SESSION_EXPIRED' | 'OFFLINE' | 'NETWORK_ERROR' };

/** Narrows a renewal failure to the codes every candidate feature's error model already handles. */
function toAccessTokenError(error: unknown): AccessTokenError {
  const code = (error as { code?: string })?.code;
  if (code === 'SESSION_EXPIRED' || code === 'OFFLINE') return { code };
  return { code: 'NETWORK_ERROR' };
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
  // The latest session, readable synchronously by getAccessToken (which is
  // called from query functions, outside React's render cycle).
  const sessionRef = useRef<AuthSession | null>(null);
  // One renewal at a time: the refresh token rotates on every use, so two
  // parallel renewals with the same token would make the server treat the
  // second as reuse and revoke the whole session.
  const renewalRef = useRef<Promise<AuthSession> | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const queryClient = useQueryClient();

  const login = useCallback((next: AuthSession) => {
    generationRef.current += 1;
    sessionRef.current = next;
    setSession(next);
    setSessionExpired(false);
  }, []);

  const logout = useCallback(
    (reason: LogoutReason = 'manual') => {
      generationRef.current += 1;
      sessionRef.current = null;
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
    setSession((current) => {
      if (!current) return current;
      const next = { ...current, consent: status };
      sessionRef.current = next;
      return next;
    });
  }, []);

  /**
   * Exchanges `current`'s refresh token for a new session, sharing one
   * in-flight renewal between every caller. Signs out only when the server
   * rejects the refresh token; a transient failure rejects with its error
   * and leaves the session as it was.
   */
  const renewSession = useCallback(
    (current: AuthSession): Promise<AuthSession> => {
      if (renewalRef.current) return renewalRef.current;

      const generation = generationRef.current;
      const renewal = (async () => {
        try {
          const refreshed = await client.refreshSession(current.refreshToken);
          // Signed out or in as someone else meanwhile: never let this
          // result overwrite the session that replaced it.
          if (generationRef.current !== generation) {
            if (sessionRef.current) return sessionRef.current;
            throw { code: 'SESSION_EXPIRED' } satisfies AccessTokenError;
          }
          sessionRef.current = refreshed;
          setSession(refreshed);
          return refreshed;
        } catch (error) {
          if (generationRef.current === generation && (error as { code?: string })?.code === 'SESSION_EXPIRED') {
            logout('expired');
          }
          throw error;
        } finally {
          renewalRef.current = null;
        }
      })();
      renewalRef.current = renewal;
      return renewal;
    },
    [client, logout]
  );

  const getAccessToken = useCallback(async () => {
    const current = sessionRef.current;
    if (!current) throw { code: 'SESSION_EXPIRED' } satisfies AccessTokenError;
    if (!isSessionDueForRefresh(current)) return current.accessToken;

    try {
      return (await renewSession(current)).accessToken;
    } catch (error) {
      // Still inside its lifetime (renewal starts a minute early): a failed
      // renewal shouldn't block a request the current token can still make.
      if (isSessionValid(current) && (error as { code?: string })?.code !== 'SESSION_EXPIRED') return current.accessToken;
      throw toAccessTokenError(error);
    }
  }, [renewSession]);

  // Renews the access token shortly before it expires so an active
  // candidate isn't sent back to the OTP screen every few minutes. An
  // access token that lapsed while the tab was in the background is not a
  // reason to sign out: the refresh token renews it here, and any screen
  // that reloads first waits for the same renewal through getAccessToken.
  useEffect(() => {
    if (!session) return undefined;
    const interval = setInterval(() => {
      if (!isSessionDueForRefresh(session)) return;
      renewSession(session).catch(() => {
        // A server rejection already signed out inside renewSession; a
        // transient failure keeps the session and retries on the next tick.
      });
    }, EXPIRY_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [session, renewSession]);

  // Signed in for as long as the refresh token can renew the session -- an
  // expired access token alone is renewed, not treated as signed out.
  const status: AuthStatus = session ? 'authenticated' : 'unauthenticated';

  const value = useMemo(
    () => ({ status, session, login, logout, sessionExpired, acknowledgeSessionExpired, setConsentStatus, getAccessToken }),
    [status, session, login, logout, sessionExpired, acknowledgeSessionExpired, setConsentStatus, getAccessToken]
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

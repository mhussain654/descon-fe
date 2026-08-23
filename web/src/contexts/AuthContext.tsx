import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isSessionValid } from '../../../shared/auth/session';
import type { AuthSession } from '../../../shared/auth/types';

export type AuthStatus = 'unauthenticated' | 'authenticated';
export type LogoutReason = 'manual' | 'expired';

interface AuthContextValue {
  status: AuthStatus;
  session: AuthSession | null;
  /** Set once by the OTP screen on successful verification. */
  login: (session: AuthSession) => void;
  logout: (reason?: LogoutReason) => void;
  /** True immediately after an expiry-triggered logout; a screen that reads it should also clear it (see `acknowledgeSessionExpired`). */
  sessionExpired: boolean;
  acknowledgeSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const EXPIRY_CHECK_INTERVAL_MS = 5000;

/**
 * Candidate session state. The token lives in memory only -- never
 * localStorage/sessionStorage -- so it can't be read back by an XSS'd
 * script later and doesn't survive a reload. This is a deliberate
 * placeholder: AGENTS.md prefers secure, httpOnly cookie sessions for web,
 * which the not-yet-built MPS-201 backend will set directly (invisible to
 * this client entirely). Once that lands, `session` collapses to "ask the
 * server whether the cookie is still valid" rather than holding a token.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const login = useCallback((next: AuthSession) => {
    setSession(next);
    setSessionExpired(false);
  }, []);

  const logout = useCallback((reason: LogoutReason = 'manual') => {
    setSession(null);
    setSessionExpired(reason === 'expired');
  }, []);

  const acknowledgeSessionExpired = useCallback(() => setSessionExpired(false), []);

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

  const status: AuthStatus = session && isSessionValid(session) ? 'authenticated' : 'unauthenticated';

  const value = useMemo(
    () => ({ status, session, login, logout, sessionExpired, acknowledgeSessionExpired }),
    [status, session, login, logout, sessionExpired, acknowledgeSessionExpired]
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

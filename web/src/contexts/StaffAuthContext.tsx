import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { isSessionValid } from '../../../shared/auth/session';
import { STAFF_ROLE_PERMISSIONS } from '../../../shared/auth/staffTypes';
import type { StaffAuthClient, StaffPermission, StaffSession } from '../../../shared/auth/staffTypes';

export type StaffAuthStatus = 'restoring' | 'unauthenticated' | 'authenticated';
export type StaffLogoutReason = 'manual' | 'expired';

interface StaffAuthContextValue {
  status: StaffAuthStatus;
  session: StaffSession | null;
  /** Set once by the sign-in screen's useStaffSignIn hook (which owns the actual client.signIn() call), mirroring the candidate AuthContext's `login(session)`. */
  login: (session: StaffSession) => void;
  signOut: (reason?: StaffLogoutReason) => Promise<void>;
  hasPermission: (permission: StaffPermission) => boolean;
  /** True immediately after an expiry-triggered sign-out; a screen that reads it should also clear it (see `acknowledgeSessionExpired`). */
  sessionExpired: boolean;
  acknowledgeSessionExpired: () => void;
}

const StaffAuthContext = createContext<StaffAuthContextValue | undefined>(undefined);

const EXPIRY_CHECK_INTERVAL_MS = 5000;

/**
 * Staff session state. Unlike the candidate side (deliberately in-memory
 * only), staff sessions must survive a reload (MPS-F202: "Session recovery
 * on reload") -- so `status` starts as `'restoring'` while the client's
 * `restoreSession()` call is in flight. Protected staff screens must not
 * render (not even briefly) during that window -- see RequireStaffAuth,
 * which shows a loading state instead.
 *
 * Must live in root.tsx (not any layout.jsx) for the same reason the
 * candidate AuthProvider does -- see the comment there -- so this session
 * survives client-side navigation between staff screens.
 */
export function StaffAuthProvider({ client, children }: { client: StaffAuthClient; children: ReactNode }) {
  const [status, setStatus] = useState<StaffAuthStatus>('restoring');
  const [session, setSession] = useState<StaffSession | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    client
      .restoreSession()
      .then((restored) => {
        if (cancelled) return;
        setSession(restored);
        setStatus(restored ? 'authenticated' : 'unauthenticated');
      })
      .catch(() => {
        if (cancelled) return;
        setSession(null);
        setStatus('unauthenticated');
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  const login = useCallback((next: StaffSession) => {
    setSession(next);
    setStatus('authenticated');
    setSessionExpired(false);
  }, []);

  const signOut = useCallback(
    async (reason: StaffLogoutReason = 'manual') => {
      setSession(null);
      setStatus('unauthenticated');
      setSessionExpired(reason === 'expired');
      // Staff-sensitive query data (candidate records, the staff directory
      // itself) must not survive into whatever the next session on this
      // device is (AGENTS.md: "Clear sensitive state and caches on logout").
      queryClient.clear();
      // Same async-await discipline as the MPS-F201 mobile logout fix: await
      // the client's own sign-out rather than firing-and-forgetting it, so a
      // failure is at least observable (even though the local UI state above
      // has already flipped, since there is nothing server-side blocking a
      // client-perceived sign-out from completing).
      await client.signOut();
    },
    [client, queryClient]
  );

  const acknowledgeSessionExpired = useCallback(() => setSessionExpired(false), []);

  const hasPermission = useCallback(
    (permission: StaffPermission) => {
      if (!session) return false;
      return STAFF_ROLE_PERMISSIONS[session.role][permission];
    },
    [session]
  );

  useEffect(() => {
    if (status !== 'authenticated' || !session) return undefined;
    const interval = setInterval(() => {
      if (!isSessionValid(session)) {
        signOut('expired');
      }
    }, EXPIRY_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [status, session, signOut]);

  const value = useMemo(
    () => ({ status, session, login, signOut, hasPermission, sessionExpired, acknowledgeSessionExpired }),
    [status, session, login, signOut, hasPermission, sessionExpired, acknowledgeSessionExpired]
  );

  return <StaffAuthContext.Provider value={value}>{children}</StaffAuthContext.Provider>;
}

export function useStaffAuth(): StaffAuthContextValue {
  const context = useContext(StaffAuthContext);
  if (!context) {
    throw new Error('useStaffAuth must be used within StaffAuthProvider');
  }
  return context;
}

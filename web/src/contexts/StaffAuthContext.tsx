import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { StaffAuthClient, StaffSession } from '../../../shared/auth/staffTypes';

export type StaffAuthStatus = 'restoring' | 'unauthenticated' | 'authenticated' | 'restore-error';
export type StaffLogoutReason = 'manual' | 'expired';

interface StaffAuthContextValue {
  status: StaffAuthStatus;
  session: StaffSession | null;
  /** Set once by the sign-in screen's useStaffSignIn hook (which owns the actual client.signIn() call), mirroring the candidate AuthContext's `login(session)`. */
  login: (session: StaffSession) => void;
  signOut: (reason?: StaffLogoutReason) => Promise<void>;
  /** Re-attempts session restoration -- for the `restore-error` status's retry action, when the initial attempt couldn't confirm a session either way (network/offline). */
  retryRestore: () => void;
  hasPermission: (permission: string) => boolean;
  /** True immediately after an expiry-triggered sign-out; a screen that reads it should also clear it (see `acknowledgeSessionExpired`). */
  sessionExpired: boolean;
  acknowledgeSessionExpired: () => void;
}

const StaffAuthContext = createContext<StaffAuthContextValue | undefined>(undefined);

const EXPIRY_CHECK_INTERVAL_MS = 5000;
/** Start refreshing this many seconds before the access token's declared expiry, rather than waiting for it to actually lapse. */
const REFRESH_BEFORE_EXPIRY_SECONDS = 60;

/**
 * Staff session state. Unlike the candidate side (deliberately in-memory
 * only), staff sessions must survive a reload (MPS-F202: "Session recovery
 * on reload") -- so `status` starts as `'restoring'` while the client's
 * `restoreSession()` call is in flight. Protected staff screens must not
 * render (not even briefly) during that window -- see RequireStaffAuth,
 * which shows a loading state instead.
 *
 * `restore-error` is distinct from `unauthenticated`: it means restoration
 * couldn't confirm *either* outcome (a network/offline failure), so an
 * existing valid session must not be discarded -- RequireStaffAuth shows a
 * retry affordance instead of bouncing to the sign-in screen (AGENTS.md /
 * ticket: "A temporary connection failure must not permanently destroy a
 * valid session").
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

  // Bumped by login()/signOut() -- an explicit, authoritative action -- so
  // a passive restore or proactive pre-expiry refresh that resolves AFTER
  // a newer action already changed state can detect it's stale and must
  // not overwrite that newer state (AGENTS.md: "Prevent stale requests
  // from changing state after logout, navigation or a newer authentication
  // attempt"). This is a *React state* guard, complementary to (not a
  // replacement for) the auth client's own internal epoch guard, which
  // protects its token storage the same way.
  const generationRef = useRef(0);

  const attemptRestore = useCallback(async () => {
    const generation = generationRef.current;
    setStatus('restoring');
    try {
      const restored = await client.restoreSession();
      if (generationRef.current !== generation) return;
      setSession(restored);
      setStatus(restored ? 'authenticated' : 'unauthenticated');
    } catch {
      if (generationRef.current !== generation) return;
      // A confirmed invalid/expired/revoked session already resolves
      // (not rejects) to `null` above -- reaching here means the client
      // couldn't tell either way (network/offline), so an existing
      // session must not be assumed lost.
      setStatus('restore-error');
    }
  }, [client]);

  useEffect(() => {
    attemptRestore();
    // Deliberately runs only on mount/client-identity-change, not on every
    // `attemptRestore` identity change (which is stable per `client`
    // anyway) -- `retryRestore` below reuses this same callback instead of
    // needing its own effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  const retryRestore = useCallback(() => {
    attemptRestore();
  }, [attemptRestore]);

  const login = useCallback((next: StaffSession) => {
    generationRef.current += 1;
    setSession(next);
    setStatus('authenticated');
    setSessionExpired(false);
  }, []);

  const signOut = useCallback(
    async (reason: StaffLogoutReason = 'manual') => {
      generationRef.current += 1;
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
    (permission: string) => session?.permissions.includes(permission) ?? false,
    [session]
  );

  // Proactively refreshes before the short-lived access token expires,
  // rather than logging out the moment it does -- only a genuinely
  // invalid/expired/revoked refresh token ends the session; a transient
  // network/offline failure here just leaves the session as-is and tries
  // again next tick (ticket: "It should attempt refresh before expiry or
  // when expiry is detected. Logout should happen only when refresh is
  // invalid, expired or revoked").
  useEffect(() => {
    if (status !== 'authenticated' || !session) return undefined;

    const interval = setInterval(async () => {
      const secondsUntilExpiry = (new Date(session.expiresAt).getTime() - Date.now()) / 1000;
      if (secondsUntilExpiry > REFRESH_BEFORE_EXPIRY_SECONDS) return;

      const generation = generationRef.current;
      try {
        const refreshed = await client.restoreSession();
        if (generationRef.current !== generation) return;
        if (refreshed) {
          setSession(refreshed);
        } else {
          // restoreSession() only resolves null for a *confirmed* invalid/
          // expired/revoked refresh token -- a real end to the session.
          signOut('expired');
        }
      } catch {
        // Network/offline -- couldn't confirm either way. Leave the
        // session as-is; the next tick tries again before the access
        // token's actual expiry is reached.
      }
    }, EXPIRY_CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [status, session, signOut, client]);

  const value = useMemo(
    () => ({
      status,
      session,
      login,
      signOut,
      retryRestore,
      hasPermission,
      sessionExpired,
      acknowledgeSessionExpired,
    }),
    [status, session, login, signOut, retryRestore, hasPermission, sessionExpired, acknowledgeSessionExpired]
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

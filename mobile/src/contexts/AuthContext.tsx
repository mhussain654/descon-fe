import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { isSessionDueForRefresh, isSessionValid } from "../../../shared/auth/session";
import type { AuthSession, CandidateAuthClient, ConsentStatus } from "../../../shared/auth/types";

const SESSION_STORE_KEY = "descon.candidateSession";

export type AuthStatus = "restoring" | "unauthenticated" | "authenticated";
export type LogoutReason = "manual" | "expired";

interface AuthContextValue {
  status: AuthStatus;
  session: AuthSession | null;
  /** Resolves once the session is durably persisted; rejects (leaving status unchanged) if persistence fails -- callers must not navigate to protected content on rejection. */
  login: (session: AuthSession) => Promise<void>;
  logout: (reason?: LogoutReason) => Promise<void>;
  /** True immediately after an expiry-triggered logout; a screen that reads it should also clear it (see `acknowledgeSessionExpired`). */
  sessionExpired: boolean;
  acknowledgeSessionExpired: () => void;
  /** Updates the current session's consent status in place (MPS-204), e.g. after the candidate accepts on the consent screen. No-op if called with no session. */
  setConsentStatus: (status: ConsentStatus) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Structural shape of a persisted session -- guards against corrupted or foreign-shaped SecureStore content (a partial write, a stale format from a previous app version) surviving into a restore. */
const authSessionSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  candidateId: z.string().min(1),
  candidateName: z.string().min(1),
  preferredLocale: z.enum(['en', 'ur']),
  expiresAt: z.string(),
  consent: z.object({
    currentPolicyVersion: z.string(),
    accepted: z.boolean(),
    acceptedAt: z.string().nullable(),
  }),
});

/** Best effort: the in-memory session is already renewed; a failed write only means the next launch refreshes again from the previous token -- which the server may have rotated, ending that session. */
async function persistSession(session: AuthSession): Promise<void> {
  try {
    await SecureStore.setItemAsync(SESSION_STORE_KEY, JSON.stringify(session));
  } catch {
    // See above.
  }
}

async function deleteStoredSessionSafely(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SESSION_STORE_KEY);
  } catch {
    // Best effort -- nothing further can be done if the platform keystore
    // itself is unavailable.
  }
}

/**
 * Reads and validates the persisted session, deleting it if it's malformed.
 * An expired access token is NOT a reason to discard it: the refresh token
 * inside may still be good, so the restore step tries to renew it.
 */
async function readPersistedSession(): Promise<AuthSession | null> {
  let raw: string | null;
  try {
    raw = await SecureStore.getItemAsync(SESSION_STORE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    await deleteStoredSessionSafely();
    return null;
  }

  const result = authSessionSchema.safeParse(parsed);
  if (!result.success) {
    await deleteStoredSessionSafely();
    return null;
  }

  return result.data;
}

const EXPIRY_CHECK_INTERVAL_MS = 5000;

/**
 * Candidate session state, backed by expo-secure-store (AGENTS.md: "Use
 * expo-secure-store ... Do not store access or refresh tokens in
 * AsyncStorage"). Unlike web, the token surviving app restarts is exactly
 * what's wanted here -- but that read is asynchronous, so `status` starts
 * as `'restoring'` until it resolves. Protected tabs must render nothing
 * during that window (see RequireAuth), not a flash of the unauthenticated
 * login screen or (worse) stale protected content.
 *
 * `login`/`logout` are async and await their SecureStore operation: a login
 * screen must not navigate to protected content until persistence actually
 * succeeds, and a failed logout deletion falls back to overwriting the
 * stored session with an already-expired marker so a restart's restore
 * treats it as invalid rather than reviving a session the UI just showed as
 * logged out.
 */
export function AuthProvider({
  children,
  client,
}: {
  children: ReactNode;
  /** Renews sessions without a new OTP. The app root passes the real client; it is not defaulted here because importing it drags the whole API/i18n stack into every provider test. Without it an expired session is simply discarded. */
  client?: CandidateAuthClient;
}) {
  // Bumped by login/logout so a refresh that was in flight when the session
  // changed can't resurrect (or overwrite) the new state when it resolves.
  const generationRef = useRef(0);
  const refreshInFlightRef = useRef(false);
  const [status, setStatus] = useState<AuthStatus>("restoring");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    const generation = generationRef.current;
    const finish = (restored: AuthSession | null) => {
      if (cancelled || generationRef.current !== generation) return;
      setSession(restored);
      setStatus(restored ? "authenticated" : "unauthenticated");
    };

    readPersistedSession().then(async (stored) => {
      if (!stored || isSessionValid(stored)) return finish(stored);
      if (!client) {
        await deleteStoredSessionSafely();
        return finish(null);
      }

      // The access token lapsed while the app was closed -- renew it from
      // the refresh token rather than making the candidate request a new
      // OTP. Only a server-confirmed rejection discards the stored session;
      // a transient failure (offline) leaves it for the next launch.
      try {
        const refreshed = await client.refreshSession(stored.refreshToken);
        await persistSession(refreshed);
        finish(refreshed);
      } catch (error) {
        if ((error as { code?: string })?.code === "SESSION_EXPIRED") await deleteStoredSessionSafely();
        finish(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [client]);

  const login = useCallback(async (next: AuthSession) => {
    generationRef.current += 1;
    await SecureStore.setItemAsync(SESSION_STORE_KEY, JSON.stringify(next));
    setSession(next);
    setStatus("authenticated");
    setSessionExpired(false);
  }, []);

  const logout = useCallback(
    async (reason: LogoutReason = "manual") => {
      generationRef.current += 1;
      setSession(null);
      setStatus("unauthenticated");
      setSessionExpired(reason === "expired");
      // Candidate-sensitive query data must not survive into whatever the
      // next session on this device is (AGENTS.md: "Clear sensitive state
      // and caches on logout").
      queryClient.clear();

      try {
        await SecureStore.deleteItemAsync(SESSION_STORE_KEY);
      } catch {
        try {
          const expiredMarker: AuthSession = {
            accessToken: "",
            refreshToken: "",
            candidateId: "",
            candidateName: "",
            preferredLocale: "en",
            expiresAt: new Date(0).toISOString(),
            consent: { currentPolicyVersion: "", accepted: false, acceptedAt: null },
          };
          await SecureStore.setItemAsync(SESSION_STORE_KEY, JSON.stringify(expiredMarker));
        } catch {
          // Best effort -- nothing further can be done from here.
        }
      }
    },
    [queryClient]
  );

  const acknowledgeSessionExpired = useCallback(() => setSessionExpired(false), []);

  const setConsentStatus = useCallback((status: ConsentStatus) => {
    setSession((current) => {
      if (!current) return current;
      const next = { ...current, consent: status };
      SecureStore.setItemAsync(SESSION_STORE_KEY, JSON.stringify(next)).catch(() => {
        // Best effort -- the in-memory session is already updated; a failed
        // persist just means a restart could re-show the consent gate once
        // more, not that the candidate loses access now.
      });
      return next;
    });
  }, []);

  // Renews the access token shortly before it expires (and right away if it
  // lapsed while the app was backgrounded) so an active candidate isn't sent
  // back to the OTP screen every few minutes. Only a server-confirmed
  // rejection of the refresh token ends the session; a transient failure
  // (offline, network, rate limit) keeps it and retries on the next tick.
  useEffect(() => {
    if (!client || status !== "authenticated" || !session) return undefined;
    const interval = setInterval(async () => {
      if (refreshInFlightRef.current || !isSessionDueForRefresh(session)) return;

      const generation = generationRef.current;
      refreshInFlightRef.current = true;
      try {
        const refreshed = await client.refreshSession(session.refreshToken);
        if (generationRef.current !== generation) return;
        setSession(refreshed);
        await persistSession(refreshed);
      } catch (error) {
        if (generationRef.current === generation && (error as { code?: string })?.code === "SESSION_EXPIRED") {
          await logout("expired");
        }
      } finally {
        refreshInFlightRef.current = false;
      }
    }, EXPIRY_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [status, session, client, logout]);

  const value = useMemo(
    () => ({ status, session, login, logout, sessionExpired, acknowledgeSessionExpired, setConsentStatus }),
    [status, session, login, logout, sessionExpired, acknowledgeSessionExpired, setConsentStatus]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

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
  /**
   * The access token every candidate API call must use. Renews it first when
   * it has expired or is about to (the app was in the background, so the
   * renewal timer was paused), so a request never goes out with a stale token
   * and gets mistaken for an ended session. Rejects with `SESSION_EXPIRED`
   * (after signing out) only when the server rejects the refresh token, and
   * with `OFFLINE`/`NETWORK_ERROR` when the renewal could not reach it.
   */
  getAccessToken: () => Promise<string>;
}

type AccessTokenError = { code: "SESSION_EXPIRED" | "OFFLINE" | "NETWORK_ERROR" };

/** Narrows a renewal failure to the codes every candidate feature's error model already handles. */
function toAccessTokenError(error: unknown): AccessTokenError {
  const code = (error as { code?: string })?.code;
  if (code === "SESSION_EXPIRED" || code === "OFFLINE") return { code };
  return { code: "NETWORK_ERROR" };
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
  // The latest session, readable synchronously by getAccessToken (which is
  // called from query functions, outside React's render cycle).
  const sessionRef = useRef<AuthSession | null>(null);
  // One renewal at a time: the refresh token rotates on every use, so two
  // parallel renewals with the same token would make the server treat the
  // second as reuse and revoke the whole session.
  const renewalRef = useRef<Promise<AuthSession> | null>(null);
  const [status, setStatus] = useState<AuthStatus>("restoring");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const queryClient = useQueryClient();

  const logout = useCallback(
    async (reason: LogoutReason = "manual") => {
      generationRef.current += 1;
      sessionRef.current = null;
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

  /**
   * Exchanges `current`'s refresh token for a new session, sharing one
   * in-flight renewal between every caller. Signs out only when the server
   * rejects the refresh token; a transient failure rejects with its error
   * and leaves the session as it was.
   */
  const renewSession = useCallback(
    (current: AuthSession): Promise<AuthSession> => {
      if (!client) return Promise.reject({ code: "SESSION_EXPIRED" } satisfies AccessTokenError);
      if (renewalRef.current) return renewalRef.current;

      const generation = generationRef.current;
      const renewal = (async () => {
        try {
          const refreshed = await client.refreshSession(current.refreshToken);
          // Signed out or in as someone else meanwhile: never let this
          // result overwrite the session that replaced it.
          if (generationRef.current !== generation) {
            if (sessionRef.current) return sessionRef.current;
            throw { code: "SESSION_EXPIRED" } satisfies AccessTokenError;
          }
          sessionRef.current = refreshed;
          setSession(refreshed);
          await persistSession(refreshed);
          return refreshed;
        } catch (error) {
          if (generationRef.current === generation && (error as { code?: string })?.code === "SESSION_EXPIRED") {
            await logout("expired");
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

  useEffect(() => {
    let cancelled = false;
    const generation = generationRef.current;
    const finish = (restored: AuthSession | null) => {
      if (cancelled || generationRef.current !== generation) return false;
      sessionRef.current = restored;
      setSession(restored);
      setStatus(restored ? "authenticated" : "unauthenticated");
      return true;
    };

    readPersistedSession().then(async (stored) => {
      if (!stored || isSessionValid(stored)) return finish(stored);
      if (!client) {
        await deleteStoredSessionSafely();
        return finish(null);
      }

      // The access token lapsed while the app was closed. Open the app on
      // the stored session straight away instead of holding the launch on a
      // network round trip, and renew it from the refresh token in the
      // background rather than asking for a new OTP (each one is a paid
      // SMS). Screens wait for that renewal through getAccessToken; only a
      // server-confirmed rejection signs the candidate out.
      if (finish(stored)) renewSession(stored).catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [client, renewSession]);

  const login = useCallback(async (next: AuthSession) => {
    generationRef.current += 1;
    await SecureStore.setItemAsync(SESSION_STORE_KEY, JSON.stringify(next));
    sessionRef.current = next;
    setSession(next);
    setStatus("authenticated");
    setSessionExpired(false);
  }, []);

  const acknowledgeSessionExpired = useCallback(() => setSessionExpired(false), []);

  const setConsentStatus = useCallback((status: ConsentStatus) => {
    setSession((current) => {
      if (!current) return current;
      const next = { ...current, consent: status };
      sessionRef.current = next;
      SecureStore.setItemAsync(SESSION_STORE_KEY, JSON.stringify(next)).catch(() => {
        // Best effort -- the in-memory session is already updated; a failed
        // persist just means a restart could re-show the consent gate once
        // more, not that the candidate loses access now.
      });
      return next;
    });
  }, []);

  const getAccessToken = useCallback(async () => {
    const current = sessionRef.current;
    if (!current) throw { code: "SESSION_EXPIRED" } satisfies AccessTokenError;
    if (!client || !isSessionDueForRefresh(current)) return current.accessToken;

    try {
      return (await renewSession(current)).accessToken;
    } catch (error) {
      // Still inside its lifetime (renewal starts a minute early): a failed
      // renewal shouldn't block a request the current token can still make.
      if (isSessionValid(current) && (error as { code?: string })?.code !== "SESSION_EXPIRED") return current.accessToken;
      throw toAccessTokenError(error);
    }
  }, [client, renewSession]);

  // Renews the access token shortly before it expires so an active candidate
  // isn't sent back to the OTP screen every few minutes. The timer is paused
  // while the app is in the background; on return, any screen that reloads
  // goes through getAccessToken and waits for the same renewal.
  useEffect(() => {
    if (!client || status !== "authenticated" || !session) return undefined;
    const interval = setInterval(() => {
      if (!isSessionDueForRefresh(session)) return;
      renewSession(session).catch(() => {
        // A server rejection already signed out inside renewSession; a
        // transient failure keeps the session and retries on the next tick.
      });
    }, EXPIRY_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [status, session, client, renewSession]);

  const value = useMemo(
    () => ({ status, session, login, logout, sessionExpired, acknowledgeSessionExpired, setConsentStatus, getAccessToken }),
    [status, session, login, logout, sessionExpired, acknowledgeSessionExpired, setConsentStatus, getAccessToken]
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

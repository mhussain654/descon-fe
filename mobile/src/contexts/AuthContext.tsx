import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { isSessionValid } from "../../../shared/auth/session";
import type { AuthSession } from "../../../shared/auth/types";

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
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Structural shape of a persisted session -- guards against corrupted or foreign-shaped SecureStore content (a partial write, a stale format from a previous app version) surviving into a restore. */
const authSessionSchema = z.object({
  accessToken: z.string().min(1),
  candidateId: z.string().min(1),
  expiresAt: z.string(),
});

async function deleteStoredSessionSafely(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SESSION_STORE_KEY);
  } catch {
    // Best effort -- nothing further can be done if the platform keystore
    // itself is unavailable.
  }
}

/** Reads and validates the persisted session, deleting it if it's malformed or expired rather than leaving it to be silently retried on every future restore. */
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
  if (!result.success || !isSessionValid(result.data)) {
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
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("restoring");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    readPersistedSession().then((restored) => {
      if (cancelled) return;
      setSession(restored);
      setStatus(restored ? "authenticated" : "unauthenticated");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (next: AuthSession) => {
    await SecureStore.setItemAsync(SESSION_STORE_KEY, JSON.stringify(next));
    setSession(next);
    setStatus("authenticated");
    setSessionExpired(false);
  }, []);

  const logout = useCallback(
    async (reason: LogoutReason = "manual") => {
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
            candidateId: "",
            expiresAt: new Date(0).toISOString(),
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

  useEffect(() => {
    if (status !== "authenticated" || !session) return undefined;
    const interval = setInterval(() => {
      if (!isSessionValid(session)) {
        logout("expired");
      }
    }, EXPIRY_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [status, session, logout]);

  const value = useMemo(
    () => ({ status, session, login, logout, sessionExpired, acknowledgeSessionExpired }),
    [status, session, login, logout, sessionExpired, acknowledgeSessionExpired]
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

import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { isSessionValid } from "../../../shared/auth/session";

const SESSION_STORE_KEY = "descon.candidateSession";

const AuthContext = createContext(undefined);

async function readPersistedSession() {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isSessionValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function persistSession(session) {
  if (session) {
    SecureStore.setItemAsync(SESSION_STORE_KEY, JSON.stringify(session)).catch(() => {});
  } else {
    SecureStore.deleteItemAsync(SESSION_STORE_KEY).catch(() => {});
  }
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
 */
export function AuthProvider({ children }) {
  const [status, setStatus] = useState("restoring");
  const [session, setSession] = useState(null);
  const [sessionExpired, setSessionExpired] = useState(false);

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

  const login = useCallback((next) => {
    setSession(next);
    setStatus("authenticated");
    setSessionExpired(false);
    persistSession(next);
  }, []);

  const logout = useCallback((reason = "manual") => {
    setSession(null);
    setStatus("unauthenticated");
    setSessionExpired(reason === "expired");
    persistSession(null);
  }, []);

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

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

// Real StaffAuthClient implementation (MPS-F204), calling the MPS-202
// backend documented in descon-be's openapi.yaml:
//   POST   /api/v1/auth/login
//   POST   /api/v1/auth/refresh
//   DELETE /api/v1/auth/logout
//
// Token storage: the backend issues bearer tokens in the JSON response body
// (SessionPayload), not an httpOnly cookie -- there is no cookie mechanism
// available from this contract, so AGENTS.md's cookie preference doesn't
// apply here; its fallback governs instead ("If bearer tokens are required,
// follow the approved storage plan"). Within that constraint, exposure is
// minimized: the access token (the credential actually used to call
// protected endpoints) lives in memory only, in this module's closure, and
// is never returned to a caller (not even via StaffSession -- see
// staffTypes.ts) -- an XSS payload reading storage, or React state, can't
// get it. Only the refresh token is persisted, in `sessionStorage`
// (tab/session-scoped, cleared on tab close, matching the storage layer
// MPS-F202 already established for staff sessions), because "authentication
// survives an allowed application reload" is otherwise unachievable with a
// bearer-token contract and no cookie support. The refresh token rotates on
// every use (the backend detects reuse of a stale one -- AGENTS.md: "Rotate
// refresh tokens and detect refresh-token reuse"), which bounds the value of
// a stolen one to a single use before rotation invalidates it.
import type { ApiClient, ApiError } from '../api-client';
import { derivePermissionsPendingBackendSupport } from './staffPermissions';
import type {
  StaffAuthClient,
  StaffAuthError,
  StaffAuthErrorCode,
  StaffRole,
  StaffSession,
  StaffSignInCredentials,
} from './staffTypes';

interface SessionPayload {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  message?: string;
  session: { id: string };
  user: { id: string; email: string; role: string };
}

const REFRESH_TOKEN_STORE_KEY = 'descon.staffRefreshToken';

/** Maps the backend's ErrorItem.code (see openapi.yaml's auth/* examples) to the shared StaffAuthErrorCode taxonomy. */
const SERVER_CODE_TO_AUTH_ERROR: Record<string, StaffAuthErrorCode> = {
  unauthorized: 'INVALID_CREDENTIALS',
  inactive_account: 'INACTIVE_ACCOUNT',
  rate_limited: 'TOO_MANY_ATTEMPTS',
  invalid_refresh_token: 'SESSION_EXPIRED',
  session_revoked: 'SESSION_EXPIRED',
};

function toStaffAuthError(error: unknown): StaffAuthError {
  const apiError = error as ApiError;
  if (!apiError || typeof apiError !== 'object' || !('code' in apiError)) {
    return { code: 'UNKNOWN' };
  }

  // Already a well-formed StaffAuthError (thrown directly by this file, not
  // from a fetch failure) -- shared/api-client.ts's ApiError always carries
  // `status`, so its absence here means this needs no remapping.
  if (!('status' in apiError)) {
    return error as StaffAuthError;
  }

  if (apiError.code === 'OFFLINE') return { code: 'OFFLINE' };
  if (apiError.code === 'NETWORK_ERROR' || apiError.code === 'TIMEOUT') return { code: 'NETWORK_ERROR' };
  if (apiError.code === 'CANCELLED') return { code: 'UNKNOWN' };

  const mapped = apiError.serverCode ? SERVER_CODE_TO_AUTH_ERROR[apiError.serverCode] : undefined;
  if (mapped) return { code: mapped };

  // A 403 without a recognized serverCode -- forward-compatible with any
  // future protected endpoint.
  if (apiError.status === 403) return { code: 'FORBIDDEN' };

  return { code: 'UNKNOWN' };
}

function toStaffSession(payload: SessionPayload): StaffSession {
  const role = payload.user.role as StaffRole;
  return {
    staffId: payload.user.id,
    email: payload.user.email,
    role,
    permissions: derivePermissionsPendingBackendSupport(role),
    expiresAt: new Date(Date.now() + payload.expires_in * 1000).toISOString(),
  };
}

export interface RealStaffAuthClientOptions {
  apiClient: ApiClient;
}

export function createStaffAuthClient({ apiClient }: RealStaffAuthClientOptions): StaffAuthClient {
  // In-memory only -- see the file-level doc comment on why this never
  // touches storage or leaves this closure.
  let accessToken: string | null = null;

  // Bumped by signIn/signOut so a refresh or sign-in that was already in
  // flight, once it resolves, can tell a newer authoritative action has
  // since superseded it and must not write stale credentials into shared
  // state (AGENTS.md: "Prevent stale requests from changing state after
  // logout, navigation or a newer authentication attempt").
  let epoch = 0;

  function readRefreshToken(): string | null {
    if (typeof sessionStorage === 'undefined') return null;
    try {
      return sessionStorage.getItem(REFRESH_TOKEN_STORE_KEY);
    } catch {
      return null;
    }
  }

  function writeRefreshToken(token: string | null): void {
    if (typeof sessionStorage === 'undefined') return;
    try {
      if (token) sessionStorage.setItem(REFRESH_TOKEN_STORE_KEY, token);
      else sessionStorage.removeItem(REFRESH_TOKEN_STORE_KEY);
    } catch {
      // Best effort -- a failed storage write just means a reload won't
      // recover the session, not a security or data-loss concern.
    }
  }

  // Dedupes concurrent refresh triggers into one request (AGENTS.md/ticket:
  // "concurrent failed API requests should share one refresh operation").
  // Cleared once settled so a later, non-concurrent refresh runs fresh.
  let refreshInFlight: Promise<StaffSession> | null = null;

  function refresh(): Promise<StaffSession> {
    if (refreshInFlight) return refreshInFlight;

    const refreshToken = readRefreshToken();
    if (!refreshToken) {
      return Promise.reject({ code: 'SESSION_EXPIRED' } satisfies StaffAuthError);
    }

    const requestEpoch = epoch;
    refreshInFlight = (async () => {
      let data: SessionPayload | undefined;
      try {
        data = await apiClient.post<SessionPayload>('/auth/refresh', { auth: { refresh_token: refreshToken } });
      } catch (error) {
        const mapped = toStaffAuthError(error);
        // The refresh token itself being invalid/expired/revoked is true
        // regardless of who asked, so always clear it. A transient
        // network/offline failure must leave storage untouched -- the
        // session is still valid, we just couldn't confirm it right now
        // (AGENTS.md/ticket: "A temporary connection failure must not
        // permanently destroy a valid session").
        if (mapped.code === 'SESSION_EXPIRED') {
          accessToken = null;
          writeRefreshToken(null);
        }
        throw mapped;
      }
      if (!data) throw { code: 'UNKNOWN' } satisfies StaffAuthError;

      if (requestEpoch !== epoch) {
        // A sign-in or sign-out started after this refresh did -- discard
        // this (otherwise valid) result entirely rather than reviving a
        // session a newer, more authoritative action has already ended or
        // replaced. Never hand back a usable session for a superseded
        // request.
        throw { code: 'UNKNOWN' } satisfies StaffAuthError;
      }

      accessToken = data.access_token;
      writeRefreshToken(data.refresh_token);
      return toStaffSession(data);
    })();

    return refreshInFlight.finally(() => {
      refreshInFlight = null;
    });
  }

  let signOutInFlight: Promise<void> | null = null;

  async function authenticatedRequest<T>(
    makeRequest: (token: string) => Promise<T | undefined>
  ): Promise<T | undefined> {
    if (!accessToken) {
      try {
        await refresh();
      } catch (error) {
        throw toStaffAuthError(error);
      }
    }

    try {
      return await makeRequest(accessToken as string);
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError && typeof apiError === 'object' && apiError.status === 403) {
        // A refreshed token doesn't fix a permission/inactive-account
        // problem -- surface it immediately, no refresh attempted.
        throw { code: 'FORBIDDEN' } satisfies StaffAuthError;
      }
      if (apiError && typeof apiError === 'object' && apiError.status === 401) {
        try {
          await refresh();
        } catch (refreshError) {
          throw toStaffAuthError(refreshError);
        }
        try {
          return await makeRequest(accessToken as string);
        } catch (retryError) {
          // Exactly one retry -- never triggers another refresh (no
          // refresh loops). A fresh token was just issued by the refresh
          // above and still got 401'd, which functionally means the
          // session doesn't work here regardless of what the endpoint's
          // own error body says -- treat it as SESSION_EXPIRED so the
          // caller gets one clean, actionable signal instead of guessing
          // from an arbitrary response shape.
          const retryApiError = retryError as ApiError;
          if (retryApiError && typeof retryApiError === 'object' && retryApiError.status === 401) {
            throw { code: 'SESSION_EXPIRED' } satisfies StaffAuthError;
          }
          throw toStaffAuthError(retryError);
        }
      }
      throw toStaffAuthError(error);
    }
  }

  return {
    async signIn({ email, password }: StaffSignInCredentials) {
      epoch += 1; // a fresh sign-in supersedes anything previously in flight
      const requestEpoch = epoch;

      let data: SessionPayload | undefined;
      try {
        data = await apiClient.post<SessionPayload>('/auth/login', { auth: { email, password } });
      } catch (error) {
        throw toStaffAuthError(error);
      }
      if (!data) throw { code: 'UNKNOWN' } satisfies StaffAuthError;

      if (requestEpoch !== epoch) {
        // A newer sign-in (or a sign-out) started after this one -- never
        // persist credentials for an attempt nothing is waiting on anymore.
        throw { code: 'UNKNOWN' } satisfies StaffAuthError;
      }

      accessToken = data.access_token;
      writeRefreshToken(data.refresh_token);
      return toStaffSession(data);
    },

    async restoreSession() {
      const refreshToken = readRefreshToken();
      if (!refreshToken) return null;
      try {
        return await refresh();
      } catch (error) {
        const authError = toStaffAuthError(error);
        if (authError.code === 'SESSION_EXPIRED') return null;
        throw authError; // network/offline/stale -- caller decides, session preserved
      }
    },

    async signOut() {
      if (signOutInFlight) return signOutInFlight;

      epoch += 1; // invalidate any in-flight refresh/sign-in from reviving the session being ended
      const tokenToRevoke = accessToken;
      signOutInFlight = (async () => {
        // Only attempt the network revoke if there's a token to revoke --
        // no point forcing a refresh just to immediately log back out, and
        // an expired/missing token still ends in the same local result.
        if (tokenToRevoke) {
          try {
            await apiClient.del('/auth/logout', { headers: { Authorization: `Bearer ${tokenToRevoke}` } });
          } catch {
            // Best effort -- the goal (ending up signed out locally) is
            // achieved regardless of whether the server round-trip
            // succeeded, same as candidate auth's logout handling.
          }
        }
        accessToken = null;
        writeRefreshToken(null);
      })();

      return signOutInFlight.finally(() => {
        signOutInFlight = null;
      });
    },

    authenticatedRequest,
  };
}

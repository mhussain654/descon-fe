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
// is never persisted -- an XSS payload reading storage can't get it. Only
// the refresh token is persisted, in `sessionStorage` (tab/session-scoped,
// cleared on tab close, matching the storage layer MPS-F202 already
// established for staff sessions), because "authentication survives an
// allowed application reload" is otherwise unachievable with a bearer-token
// contract and no cookie support. The refresh token rotates on every use
// (the backend detects reuse of a stale one -- AGENTS.md: "Rotate refresh
// tokens and detect refresh-token reuse"), which bounds the value of a
// stolen one to a single use before rotation invalidates it.
import type { ApiClient, ApiError } from '../api-client';
import type { StaffAuthClient, StaffAuthError, StaffAuthErrorCode, StaffRole, StaffSession, StaffSignInCredentials } from './staffTypes';

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
  // future protected endpoint; nothing in the app triggers this today (see
  // staffTypes.ts's FORBIDDEN doc comment).
  if (apiError.status === 403) return { code: 'FORBIDDEN' };

  return { code: 'UNKNOWN' };
}

function toStaffSession(payload: SessionPayload): StaffSession {
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    staffId: payload.user.id,
    email: payload.user.email,
    role: payload.user.role as StaffRole,
    expiresAt: new Date(Date.now() + payload.expires_in * 1000).toISOString(),
  };
}

export interface RealStaffAuthClientOptions {
  apiClient: ApiClient;
}

export function createStaffAuthClient({ apiClient }: RealStaffAuthClientOptions): StaffAuthClient {
  // In-memory only -- see the file-level doc comment on why this never
  // touches storage.
  let accessToken: string | null = null;

  // Bumped by signIn/signOut so a refresh that was already in flight, once
  // it resolves, can tell it's stale and must not overwrite state a newer
  // action has since superseded (AGENTS.md: "Prevent stale requests from
  // changing state after logout, navigation or a newer authentication
  // attempt").
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
      try {
        const data = await apiClient.post<SessionPayload>('/auth/refresh', { auth: { refresh_token: refreshToken } });
        if (!data) throw { code: 'UNKNOWN' } satisfies StaffAuthError;
        const session = toStaffSession(data);
        if (requestEpoch === epoch) {
          accessToken = session.accessToken;
          writeRefreshToken(session.refreshToken);
        }
        return session;
      } catch (error) {
        if (requestEpoch === epoch) {
          accessToken = null;
          writeRefreshToken(null);
        }
        throw toStaffAuthError(error);
      }
    })();

    return refreshInFlight.finally(() => {
      refreshInFlight = null;
    });
  }

  let signOutInFlight: Promise<void> | null = null;

  return {
    async signIn({ email, password }: StaffSignInCredentials) {
      epoch += 1; // a fresh sign-in supersedes anything previously in flight
      try {
        const data = await apiClient.post<SessionPayload>('/auth/login', { auth: { email, password } });
        if (!data) throw { code: 'UNKNOWN' } satisfies StaffAuthError;
        const session = toStaffSession(data);
        accessToken = session.accessToken;
        writeRefreshToken(session.refreshToken);
        return session;
      } catch (error) {
        throw toStaffAuthError(error);
      }
    },

    async restoreSession() {
      const refreshToken = readRefreshToken();
      if (!refreshToken) return null;
      try {
        return await refresh();
      } catch (error) {
        const authError = error as StaffAuthError;
        if (authError.code === 'SESSION_EXPIRED') return null;
        throw authError; // a genuine network/service failure -- surface it, don't claim "no session"
      }
    },

    async signOut() {
      if (signOutInFlight) return signOutInFlight;

      epoch += 1; // invalidate any in-flight refresh from reviving the session being ended
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
  };
}

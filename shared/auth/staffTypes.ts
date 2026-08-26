// Staff authentication types (MPS-F202, wired to the real MPS-202 backend).
// Mirrors shared/auth/types.ts's candidate-auth shape: a typed client
// interface any implementation (mock for tests, `realStaffAuthClient.ts` for
// the app) must satisfy, so screens are written once against the interface.
//
// Role values and the `StaffSession`/error shapes below come directly from
// descon-be's openapi.yaml (`UserProfile`, `SessionPayload`) and
// `app/models/user.rb`'s `STAFF_ROLE_CODES` -- not invented here.

export type StaffRole = 'admin' | 'hr' | 'mps' | 'finance' | 'management';

export type StaffStatus = 'active' | 'invited' | 'suspended';

/**
 * Relative privilege ranking, used only to decide whether a role *change*
 * counts as a downgrade (requires confirmation -- MPS-F203) or an upgrade
 * (doesn't). The backend only special-cases `admin` (see `User#admin?`);
 * the other four are peer functional roles with no defined hierarchy among
 * them, so they share the same rank -- moving between any two of them is
 * never treated as a downgrade, only losing `admin` is.
 */
export const STAFF_ROLE_RANK: Record<StaffRole, number> = {
  admin: 1,
  hr: 0,
  mps: 0,
  finance: 0,
  management: 0,
};

/**
 * Safe identity/session information for UI consumption. Deliberately
 * contains no tokens -- the access and refresh tokens stay private inside
 * the auth client's closure (see realStaffAuthClient.ts) and are never
 * returned to callers, so they can't end up in React state, DevTools,
 * error-reporting breadcrumbs or anywhere else outside the client itself.
 * Anything that needs to make an authenticated request goes through the
 * client's `authenticatedRequest`, not a token pulled out of this object.
 */
export interface StaffSession {
  staffId: string;
  email: string;
  role: StaffRole;
  /** Effective permission codes for this session (see staffPermissions.ts for how these are currently derived, pending real backend support). */
  permissions: string[];
  /** ISO 8601 timestamp. */
  expiresAt: string;
}

export interface StaffSignInCredentials {
  email: string;
  password: string;
}

export type StaffAuthErrorCode =
  /** Unknown email or wrong password -- unified into one code so the UI can never reveal which. */
  | 'INVALID_CREDENTIALS'
  /** 403 `inactive_account` -- a real, disclosable reason (distinct from INVALID_CREDENTIALS, which never reveals why). */
  | 'INACTIVE_ACCOUNT'
  /** Safe to disclose: describes an attempt-rate pattern, not anything about a specific account. */
  | 'TOO_MANY_ATTEMPTS'
  | 'SESSION_EXPIRED'
  /** A protected resource returned 403 for a reason other than an inactive account (forward-compatible; nothing in the app triggers this today). */
  | 'FORBIDDEN'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVICE_UNAVAILABLE'
  | 'UNKNOWN';

export interface StaffAuthError {
  code: StaffAuthErrorCode;
}

export interface StaffAuthClient {
  signIn(credentials: StaffSignInCredentials): Promise<StaffSession>;
  /**
   * Recovers the current session on app load, and doubles as the
   * proactive pre-expiry refresh (StaffAuthContext calls this again before
   * the access token expires). Resolves `null` only for a *confirmed*
   * absence of a valid session -- no refresh token, or one the server
   * reports as invalid/expired/revoked. Rejects for anything that couldn't
   * confirm either way (network/offline/service failure) so a caller can
   * tell "definitely logged out" apart from "couldn't check right now" and
   * preserve an existing session across a transient failure instead of
   * discarding it.
   */
  restoreSession(): Promise<StaffSession | null>;
  signOut(): Promise<void>;
  /**
   * Runs a bearer-authenticated call through this client's managed session:
   * attaches the current access token, and on a 401 performs one shared
   * (deduped) refresh and retries the request exactly once -- never more,
   * so a persistently-401ing endpoint can't loop. A 403 is surfaced
   * immediately as FORBIDDEN without attempting a refresh (a refreshed
   * token doesn't fix a permission/account problem). If the refresh itself
   * fails, the thrown StaffAuthError distinguishes SESSION_EXPIRED (the
   * refresh token really is invalid/expired/revoked -- the caller should
   * treat this as a forced logout) from NETWORK_ERROR/OFFLINE (session
   * preserved; the caller can retry later). Every other feature's
   * staff-authenticated calls should go through this rather than reading a
   * token directly -- there isn't one to read.
   */
  authenticatedRequest<T>(makeRequest: (accessToken: string) => Promise<T | undefined>): Promise<T | undefined>;
}

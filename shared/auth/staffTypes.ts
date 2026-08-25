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

export interface StaffSession {
  accessToken: string;
  refreshToken: string;
  staffId: string;
  email: string;
  role: StaffRole;
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
   * Recovers the current session on app load (MPS-F202: "Session recovery
   * on reload"). Resolves `null` for "no session" -- including an expired,
   * invalid, revoked, or simply absent one -- since that's the normal/expected
   * outcome, not a failure; only rejects for a genuine service failure
   * (network/offline/service-unavailable).
   */
  restoreSession(): Promise<StaffSession | null>;
  signOut(): Promise<void>;
}

// Staff authentication types (MPS-F202). Mirrors shared/auth/types.ts's
// candidate-auth shape: a typed client interface any implementation (mock
// today, MPS-202's real API later) must satisfy, so screens are written
// once against the interface and never against a specific implementation.

export type StaffRole = 'admin' | 'manager' | 'viewer';

export type StaffStatus = 'active' | 'invited' | 'suspended';

/**
 * Relative privilege ranking, used only to decide whether a role *change*
 * counts as a downgrade (requires confirmation -- MPS-F203) or an upgrade
 * (doesn't). Not used for access-control decisions -- see
 * `STAFF_ROLE_PERMISSIONS` for that.
 */
export const STAFF_ROLE_RANK: Record<StaffRole, number> = {
  viewer: 0,
  manager: 1,
  admin: 2,
};

export type StaffPermission = 'canManageStaff' | 'canVerifyDocuments';

/**
 * Illustrative role→permission mapping for the mock implementation. Not a
 * final product decision -- once MPS-205's real API/contract exists, this
 * moves server-side and the frontend only reads whatever permission set the
 * session response declares (AGENTS.md: "Enforce authorization on the
 * backend; frontend route guards are UX controls, not a security boundary").
 */
export const STAFF_ROLE_PERMISSIONS: Record<StaffRole, Record<StaffPermission, boolean>> = {
  admin: { canManageStaff: true, canVerifyDocuments: true },
  manager: { canManageStaff: false, canVerifyDocuments: true },
  viewer: { canManageStaff: false, canVerifyDocuments: false },
};

export interface StaffSession {
  accessToken: string;
  staffId: string;
  name: string;
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
  /** Unknown email, wrong password, locked or suspended account -- unified into one code so the UI can never reveal which. */
  | 'INVALID_CREDENTIALS'
  /** Safe to disclose: describes an attempt-rate pattern, not anything about a specific account. */
  | 'TOO_MANY_ATTEMPTS'
  | 'SESSION_EXPIRED'
  /** Authenticated, but lacking the permission a route/action requires. */
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
   * malformed, or simply absent one -- since that's the normal/expected
   * outcome, not a failure; only rejects for a genuine service failure.
   */
  restoreSession(): Promise<StaffSession | null>;
  signOut(): Promise<void>;
}

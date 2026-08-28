// In-memory + sessionStorage-backed mock implementation of StaffAuthClient
// (MPS-F202). Stands in for the not-yet-built MPS-202 staff-auth API during
// UI development. This mock is never wired into the app now that the real
// MPS-202 client (`realStaffAuthClient.ts`) exists -- it stays only as
// dev/test scaffolding.
import type { StaffAuthClient, StaffAuthError, StaffRole, StaffSession, StaffSignInCredentials } from './staffTypes';

const SESSION_STORE_KEY = 'descon.staffSession.mock';
const SESSION_DURATION_MS = 60 * 60 * 1000;

/** The only credentials that sign in successfully in the mock -- a documented dev/test convenience, exactly like MPS-F201's `MOCK_VALID_OTP`. */
export const MOCK_STAFF_PASSWORD = 'Passw0rd!';

export const MOCK_STAFF_MAX_ATTEMPTS = 5;

interface MockStaffAccount {
  staffId: string;
  name: string;
  email: string;
  role: StaffRole;
  /** Mirrors descon-be's db/seeds.rb role->permission matrix for these accounts' roles -- fixture data, not a client-side role->permission mapping function (the real client never derives permissions from role; see realStaffAuthClient.ts). */
  permissions: string[];
  /** Both a locked and a suspended account exist so their sign-in failures can be proven identical to a wrong-password failure (MPS-F202: never reveal why). */
  locked?: boolean;
  suspended?: boolean;
}

export const MOCK_STAFF_ACCOUNTS: MockStaffAccount[] = [
  {
    staffId: 'staff_admin_1',
    name: 'Ayesha Admin',
    email: 'admin@descon.com',
    role: 'admin',
    permissions: ['manage_staff_users', 'manage_candidate_documents'],
  },
  {
    staffId: 'staff_hr_1',
    name: 'Bilal HR',
    email: 'hr@descon.com',
    role: 'hr',
    permissions: ['manage_candidate_documents', 'manage_candidates', 'manage_communications'],
  },
  {
    staffId: 'staff_finance_1',
    name: 'Sana Finance',
    email: 'finance@descon.com',
    role: 'finance',
    permissions: ['view_candidates', 'view_candidate_documents', 'manage_payments'],
  },
  {
    staffId: 'staff_mps_1',
    name: 'Omar MPS',
    email: 'mps@descon.com',
    role: 'mps',
    permissions: ['view_candidates', 'manage_candidate_assignments', 'manage_candidate_documents', 'manage_workflow', 'manage_communications'],
  },
  {
    staffId: 'staff_management_1',
    name: 'Nadia Management',
    email: 'management@descon.com',
    role: 'management',
    permissions: [
      'view_candidates',
      'view_candidate_assignments',
      'view_candidate_documents',
      'view_workflow',
      'view_payments',
      'view_communications',
      'view_audit_events',
    ],
  },
  {
    staffId: 'staff_locked_1',
    name: 'Locked Account',
    email: 'locked@descon.com',
    role: 'hr',
    permissions: ['manage_candidate_documents', 'manage_candidates', 'manage_communications'],
    locked: true,
  },
  {
    staffId: 'staff_suspended_1',
    name: 'Suspended Account',
    email: 'suspended@descon.com',
    role: 'hr',
    permissions: ['manage_candidate_documents', 'manage_candidates', 'manage_communications'],
    suspended: true,
  },
];

/** What actually gets persisted for mock "session recovery on reload" -- no tokens, matching the real client's contract that tokens never leave the client's own memory (see staffTypes.ts's StaffSession doc comment). */
interface StoredMockSession {
  staffId: string;
  email: string;
  role: StaffRole;
  permissions: string[];
  expiresAt: string;
}

function randomToken(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function readSessionStorage(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    return sessionStorage.getItem(SESSION_STORE_KEY);
  } catch {
    return null;
  }
}

function writeSessionStorage(session: StoredMockSession | null): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    if (session) {
      sessionStorage.setItem(SESSION_STORE_KEY, JSON.stringify(session));
    } else {
      sessionStorage.removeItem(SESSION_STORE_KEY);
    }
  } catch {
    // Best effort -- a failed mock-storage write just means recovery won't
    // work this session, not a real security or data-loss concern.
  }
}

function isValidStoredMockSession(value: unknown): value is StoredMockSession {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.staffId === 'string' &&
    typeof v.email === 'string' &&
    typeof v.role === 'string' &&
    Array.isArray(v.permissions) &&
    v.permissions.every((permission) => typeof permission === 'string') &&
    typeof v.expiresAt === 'string'
  );
}

export interface MockStaffAuthClientOptions {
  /** Simulated network latency in ms. Set to 0 in tests. */
  delayMs?: number;
}

/**
 * `sessionStorage` here is mock-only scaffolding to simulate "the browser
 * already knows who's signed in" (MPS-F202: session recovery on reload)
 * without a real backend. It is cleared when the tab closes and never
 * contains anything beyond what this mock itself invented. The real backend
 * issues bearer tokens (not an httpOnly cookie session), so
 * `realStaffAuthClient.ts`'s storage plan is deliberately different from
 * this mock's -- see the doc comment there.
 */
export function createMockStaffAuthClient(options: MockStaffAuthClientOptions = {}): StaffAuthClient {
  const { delayMs = 400 } = options;
  const failedAttemptsByEmail = new Map<string, number>();
  // Private to this client instance, like the real client's -- never
  // returned from signIn/restoreSession (see StaffSession's doc comment).
  let accessToken: string | null = null;

  const wait = () => (delayMs > 0 ? new Promise((resolve) => setTimeout(resolve, delayMs)) : Promise.resolve());

  return {
    async signIn({ email, password }: StaffSignInCredentials) {
      await wait();

      const normalizedEmail = email.trim().toLowerCase();
      const attempts = failedAttemptsByEmail.get(normalizedEmail) ?? 0;
      if (attempts >= MOCK_STAFF_MAX_ATTEMPTS) {
        throw { code: 'TOO_MANY_ATTEMPTS' } satisfies StaffAuthError;
      }

      const account = MOCK_STAFF_ACCOUNTS.find((candidate) => candidate.email.toLowerCase() === normalizedEmail);
      const credentialsValid = !!account && !account.locked && !account.suspended && password === MOCK_STAFF_PASSWORD;

      if (!credentialsValid) {
        failedAttemptsByEmail.set(normalizedEmail, attempts + 1);
        // Unknown email, wrong password, locked and suspended all fail
        // identically -- never reveal which (MPS-F202).
        throw { code: 'INVALID_CREDENTIALS' } satisfies StaffAuthError;
      }

      failedAttemptsByEmail.delete(normalizedEmail);
      accessToken = `mock_staff_${randomToken()}`;
      const stored: StoredMockSession = {
        staffId: account.staffId,
        email: account.email,
        role: account.role,
        permissions: account.permissions,
        expiresAt: new Date(Date.now() + SESSION_DURATION_MS).toISOString(),
      };
      writeSessionStorage(stored);
      return stored;
    },

    async restoreSession() {
      await wait();
      const raw = readSessionStorage();
      if (!raw) return null;

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        writeSessionStorage(null);
        return null;
      }

      if (!isValidStoredMockSession(parsed) || new Date(parsed.expiresAt).getTime() <= Date.now()) {
        writeSessionStorage(null);
        return null;
      }

      accessToken = `mock_staff_${randomToken()}`;
      return parsed;
    },

    async signOut() {
      await wait();
      accessToken = null;
      writeSessionStorage(null);
    },

    async authenticatedRequest(makeRequest) {
      if (!accessToken) {
        throw { code: 'SESSION_EXPIRED' } satisfies StaffAuthError;
      }
      return makeRequest(accessToken);
    },

    async authenticatedDataRequest(makeRequest) {
      if (!accessToken) {
        throw { code: 'SESSION_EXPIRED' } satisfies StaffAuthError;
      }
      return makeRequest(accessToken);
    },
  };
}

/**
 * Safe fallback for any build where the mock must not be reachable (i.e.
 * production, until MPS-202 ships a real implementation) but no real
 * implementation has been wired in yet -- same rationale as MPS-F201's
 * `createUnavailableCandidateAuthClient`. `signIn` fails safely;
 * `restoreSession` resolves `null` (indistinguishable from "no session")
 * rather than surfacing an alarming error on every page load; `signOut` is
 * a no-op since there is nothing server-side to invalidate.
 */
export function createUnavailableStaffAuthClient(): StaffAuthClient {
  return {
    signIn: () => Promise.reject({ code: 'SERVICE_UNAVAILABLE' } satisfies StaffAuthError),
    restoreSession: () => Promise.resolve(null),
    signOut: () => Promise.resolve(),
    authenticatedRequest: () => Promise.reject({ code: 'SERVICE_UNAVAILABLE' } satisfies StaffAuthError),
    authenticatedDataRequest: () => Promise.reject({ code: 'SERVICE_UNAVAILABLE' } satisfies StaffAuthError),
  };
}

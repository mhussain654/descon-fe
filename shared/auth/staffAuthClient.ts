// In-memory + sessionStorage-backed mock implementation of StaffAuthClient
// (MPS-F202). Stands in for the not-yet-built MPS-202 staff-auth API during
// UI development. Swapping to the real backend later means writing one new
// class implementing `StaffAuthClient` (calling shared/api-client.ts like
// every other feature) and changing the single call site that constructs
// the client -- no screen, hook or context change.
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
  /** Both a locked and a suspended account exist so their sign-in failures can be proven identical to a wrong-password failure (MPS-F202: never reveal why). */
  locked?: boolean;
  suspended?: boolean;
}

export const MOCK_STAFF_ACCOUNTS: MockStaffAccount[] = [
  { staffId: 'staff_admin_1', name: 'Ayesha Admin', email: 'admin@descon.com', role: 'admin' },
  { staffId: 'staff_manager_1', name: 'Bilal Manager', email: 'manager@descon.com', role: 'manager' },
  { staffId: 'staff_viewer_1', name: 'Sana Viewer', email: 'viewer@descon.com', role: 'viewer' },
  { staffId: 'staff_locked_1', name: 'Locked Account', email: 'locked@descon.com', role: 'viewer', locked: true },
  { staffId: 'staff_suspended_1', name: 'Suspended Account', email: 'suspended@descon.com', role: 'viewer', suspended: true },
];

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

function writeSessionStorage(session: StaffSession | null): void {
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

function isValidStaffSessionShape(value: unknown): value is StaffSession {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.accessToken === 'string' &&
    typeof v.staffId === 'string' &&
    typeof v.name === 'string' &&
    typeof v.email === 'string' &&
    typeof v.role === 'string' &&
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
 * contains anything beyond what this mock itself invented. The real MPS-202
 * implementation replaces this entirely: `restoreSession()` becomes a plain
 * `GET` that succeeds or 401s based on an httpOnly cookie the browser
 * attaches automatically -- no client-side storage of any kind
 * (AGENTS.md: "Prefer secure, httpOnly cookie sessions for web").
 */
export function createMockStaffAuthClient(options: MockStaffAuthClientOptions = {}): StaffAuthClient {
  const { delayMs = 400 } = options;
  const failedAttemptsByEmail = new Map<string, number>();

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
      const session: StaffSession = {
        accessToken: `mock_staff_${randomToken()}`,
        staffId: account.staffId,
        name: account.name,
        email: account.email,
        role: account.role,
        expiresAt: new Date(Date.now() + SESSION_DURATION_MS).toISOString(),
      };
      writeSessionStorage(session);
      return session;
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

      if (!isValidStaffSessionShape(parsed) || new Date(parsed.expiresAt).getTime() <= Date.now()) {
        writeSessionStorage(null);
        return null;
      }

      return parsed;
    },

    async signOut() {
      await wait();
      writeSessionStorage(null);
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
  };
}

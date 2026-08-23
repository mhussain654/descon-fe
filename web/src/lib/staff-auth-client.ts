// Web configuration for the staff authentication client (MPS-F202). Mirrors
// auth-client.ts's shape exactly: this file is the single place that
// decides which StaffAuthClient implementation is active. The real MPS-202
// implementation (once it exists) is a second file next to
// ../../../shared/auth/staffAuthClient.ts calling shared/api-client.ts,
// swapped in here -- no screen, hook or context change required, since
// everything else is written against the `StaffAuthClient` interface.
import { createMockStaffAuthClient, createUnavailableStaffAuthClient } from '../../../shared/auth/staffAuthClient';
import type { StaffAuthClient } from '../../../shared/auth/staffTypes';

export type { StaffAuthClient, StaffAuthError, StaffAuthErrorCode, StaffRole, StaffSession } from '../../../shared/auth/staffTypes';

/**
 * `isDev` is threaded in (rather than reading `import.meta.env.DEV` inline
 * here) so this selection itself is unit-testable without needing to stub
 * Vite's build-time env replacement -- see staff-auth-client.test.ts. The
 * real export below still uses `import.meta.env.DEV` directly, which Vite
 * replaces with a literal at build time; in a production build that makes
 * the mock branch statically unreachable, so Rollup's tree-shaking drops
 * staffAuthClient.ts's mock implementation out of the bundle entirely --
 * not just unreachable at runtime.
 */
export function selectStaffAuthClient(isDev: boolean): StaffAuthClient {
  if (isDev) {
    return createMockStaffAuthClient();
  }
  // No real MPS-202 backend is wired up yet. Production must never fall
  // back to the mock (AGENTS.md: "Never silently fall back to mock data in
  // production") -- every call fails safely instead.
  return createUnavailableStaffAuthClient();
}

export const staffAuthClient = selectStaffAuthClient(import.meta.env.DEV);

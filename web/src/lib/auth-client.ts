// Web configuration for the candidate authentication client (MPS-F201).
// Mirrors api-client.ts's shape: this file is the single place that decides
// which CandidateAuthClient implementation is active. The real MPS-201
// implementation (once it exists) is a second file next to
// ../../../shared/auth/candidateAuthClient.ts calling shared/api-client.ts,
// swapped in here -- no screen or hook change required, since everything
// else is written against the `CandidateAuthClient` interface.
import {
  createMockCandidateAuthClient,
  createUnavailableCandidateAuthClient,
} from '../../../shared/auth/candidateAuthClient';
import type { CandidateAuthClient } from '../../../shared/auth/types';

export type {
  AuthError,
  AuthErrorCode,
  AuthSession,
  CandidateAuthClient,
  OtpChallenge,
} from '../../../shared/auth/types';

function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

/**
 * `isDev` is threaded in (rather than reading `import.meta.env.DEV` inline
 * here) so this selection itself is unit-testable without needing to stub
 * Vite's build-time env replacement -- see auth-client.test.ts. The real
 * export below still uses `import.meta.env.DEV` directly, which Vite
 * replaces with a literal at build time; in a production build that makes
 * the mock branch statically unreachable, so Rollup's tree-shaking drops
 * candidateAuthClient.ts's mock implementation (its OTP, CNIC and delay
 * constants included) out of the bundle entirely -- not just unreachable at
 * runtime. See auth-client.build.test.ts, which asserts this against the
 * actual built output.
 */
export function selectCandidateAuthClient(isDev: boolean): CandidateAuthClient {
  if (isDev) {
    return createMockCandidateAuthClient({ isOnline });
  }
  // No real MPS-201 backend is wired up yet. Production must never fall
  // back to the mock (AGENTS.md / MPS-F201 review: "Production must never
  // silently use mocks") -- every call fails safely instead.
  return createUnavailableCandidateAuthClient();
}

export const candidateAuthClient = selectCandidateAuthClient(import.meta.env.DEV);

// Mobile configuration for the candidate authentication client (MPS-F201).
// See web/src/lib/auth-client.ts for the shared rationale -- this is the
// single place that decides which CandidateAuthClient implementation is
// active, so swapping in the real MPS-201 backend later touches only here.
import NetInfo from '@react-native-community/netinfo';
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

let isOnline = true;
NetInfo.addEventListener((state) => {
  isOnline = state.isConnected !== false && state.isInternetReachable !== false;
});

/**
 * `isDev` is threaded in (rather than reading `__DEV__` inline here) so this
 * selection itself is unit-testable without depending on Metro's global.
 * The real export below uses `__DEV__` directly -- Metro strips
 * `if (__DEV__)`-guarded code from release bundles, so in a production
 * build the mock branch is dropped from the bundle, not just unreachable at
 * runtime (AGENTS.md / MPS-F201 review: "Production must never silently use
 * mocks").
 */
export function selectCandidateAuthClient(isDev: boolean): CandidateAuthClient {
  if (isDev) {
    return createMockCandidateAuthClient({ isOnline: () => isOnline });
  }
  // No real MPS-201 backend is wired up yet -- every call fails safely
  // instead of silently accepting the mock's well-known OTP.
  return createUnavailableCandidateAuthClient();
}

export const candidateAuthClient = selectCandidateAuthClient(__DEV__);

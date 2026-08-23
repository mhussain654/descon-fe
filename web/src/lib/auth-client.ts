// Web configuration for the candidate authentication client (MPS-F201).
// Mirrors api-client.ts's shape: this file is the single place that decides
// which CandidateAuthClient implementation is active. The real MPS-201
// implementation (once it exists) is a second file next to
// ../../../shared/auth/candidateAuthClient.ts calling shared/api-client.ts,
// swapped in here -- no screen or hook change required, since everything
// else is written against the `CandidateAuthClient` interface.
import { createMockCandidateAuthClient } from '../../../shared/auth/candidateAuthClient';

export type {
  AuthError,
  AuthErrorCode,
  AuthSession,
  CandidateAuthClient,
  OtpChallenge,
} from '../../../shared/auth/types';

export const candidateAuthClient = createMockCandidateAuthClient({
  isOnline: () => typeof navigator === 'undefined' || navigator.onLine !== false,
});

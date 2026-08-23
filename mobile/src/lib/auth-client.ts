// Mobile configuration for the candidate authentication client (MPS-F201).
// See web/src/lib/auth-client.ts for the shared rationale -- this is the
// single place that decides which CandidateAuthClient implementation is
// active, so swapping in the real MPS-201 backend later touches only here.
import NetInfo from '@react-native-community/netinfo';
import { createMockCandidateAuthClient } from '../../../shared/auth/candidateAuthClient';

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

export const candidateAuthClient = createMockCandidateAuthClient({
  isOnline: () => isOnline,
});

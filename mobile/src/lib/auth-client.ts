// Mobile configuration for the candidate authentication client (MPS-206).
// Wires the real MPS-201 backend (shared/auth/realCandidateAuthClient.ts,
// calling shared/api-client.ts's apiClient) -- the mock
// (shared/auth/candidateAuthClient.ts) now exists purely for local
// dev-without-a-backend convenience and tests, never wired into the app.
import { createCandidateAuthClient } from '../../../shared/auth/realCandidateAuthClient';
import type { CandidateAuthClient } from '../../../shared/auth/types';
import { getCachedLanguage } from '../contexts/LanguageContext';
import { apiClient } from './api-client';

export type {
  AuthError,
  AuthErrorCode,
  AuthSession,
  CandidateAuthClient,
  OtpChallenge,
} from '../../../shared/auth/types';

export const candidateAuthClient: CandidateAuthClient = createCandidateAuthClient({
  apiClient,
  // getCachedLanguage is exported from a plain .jsx file, so TS widens its
  // return type to `string` -- it's only ever set to 'en' or 'ur' (see
  // LanguageContext.jsx's readPersistedLanguage), which the app's own
  // language switching enforces.
  getLocale: () => getCachedLanguage() as 'en' | 'ur',
});

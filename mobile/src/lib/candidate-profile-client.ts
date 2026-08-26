// Mobile configuration for the candidate self-profile client (mirrors
// web/src/lib/candidate-profile-client.ts exactly). Wires the real backend
// (shared/candidateProfile/realCandidateProfileClient.ts, calling
// shared/api-client.ts's apiClient).
import { createCandidateProfileClient } from '../../../shared/candidateProfile/realCandidateProfileClient';
import type { CandidateProfile, CandidateProfileClient, CandidateProfileError, CandidateProfileErrorCode } from '../../../shared/candidateProfile/types';
import { getCachedLanguage } from '../contexts/LanguageContext';
import { apiClient } from './api-client';

export type { CandidateProfile, CandidateProfileClient, CandidateProfileError, CandidateProfileErrorCode };

export const candidateProfileClient: CandidateProfileClient = createCandidateProfileClient({
  apiClient,
  // getCachedLanguage is exported from a plain .jsx file, so TS widens its
  // return type to `string` -- see mobile/src/lib/auth-client.ts's identical comment.
  getLocale: () => getCachedLanguage() as 'en' | 'ur',
});

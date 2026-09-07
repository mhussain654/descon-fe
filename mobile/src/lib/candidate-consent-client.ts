// Mobile configuration for the candidate consent client (mirrors
// web/src/lib/candidate-consent-client.ts exactly). Wires the real backend
// (shared/candidateConsent/realCandidateConsentClient.ts, calling
// shared/api-client.ts's apiClient).
import { createCandidateConsentClient } from '../../../shared/candidateConsent/realCandidateConsentClient';
import type { CandidateConsentClient, CandidateConsentError, CandidateConsentErrorCode } from '../../../shared/candidateConsent/types';
import { getCachedLanguage } from '../contexts/LanguageContext';
import { apiClient } from './api-client';

export type { CandidateConsentClient, CandidateConsentError, CandidateConsentErrorCode };

export const candidateConsentClient: CandidateConsentClient = createCandidateConsentClient({
  apiClient,
  // getCachedLanguage is exported from a plain .jsx file, so TS widens its
  // return type to `string` -- see mobile/src/lib/auth-client.ts's identical comment.
  getLocale: () => getCachedLanguage() as 'en' | 'ur',
});

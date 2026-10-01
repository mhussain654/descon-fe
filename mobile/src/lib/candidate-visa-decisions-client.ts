// Mobile configuration for the candidate visa-decisions client (mirrors
// web/src/lib/candidate-visa-decisions-client.ts exactly). Wires the real
// backend (shared/candidateVisaDecisions/realCandidateVisaDecisionsClient.ts).
import { createCandidateVisaDecisionsClient } from '../../../shared/candidateVisaDecisions/realCandidateVisaDecisionsClient';
import type {
  CandidateVisaDecision,
  CandidateVisaDecisionsClient,
  CandidateVisaDecisionsError,
  CandidateVisaDecisionsErrorCode,
  VisaCopyAccess,
} from '../../../shared/candidateVisaDecisions/types';
import { getCachedLanguage } from '../contexts/LanguageContext';
import { apiClient } from './api-client';

export type {
  CandidateVisaDecision,
  CandidateVisaDecisionsClient,
  CandidateVisaDecisionsError,
  CandidateVisaDecisionsErrorCode,
  VisaCopyAccess,
};

export const candidateVisaDecisionsClient: CandidateVisaDecisionsClient = createCandidateVisaDecisionsClient({
  apiClient,
  // getCachedLanguage is exported from a plain .jsx file, so TS widens its
  // return type to `string` -- see mobile/src/lib/auth-client.ts's identical comment.
  getLocale: () => getCachedLanguage() as 'en' | 'ur',
});

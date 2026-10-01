// Web configuration for the candidate visa-decisions client, wired to the
// real backend (shared/candidateVisaDecisions/realCandidateVisaDecisionsClient.ts).
// Mirrors candidate-flight-detail-client.ts's locale-reading convention exactly.
import { createCandidateVisaDecisionsClient } from '../../../shared/candidateVisaDecisions/realCandidateVisaDecisionsClient';
import type {
  CandidateVisaDecision,
  CandidateVisaDecisionsClient,
  CandidateVisaDecisionsError,
  CandidateVisaDecisionsErrorCode,
  VisaCopyAccess,
} from '../../../shared/candidateVisaDecisions/types';
import { apiClient } from './api-client';

export type {
  CandidateVisaDecision,
  CandidateVisaDecisionsClient,
  CandidateVisaDecisionsError,
  CandidateVisaDecisionsErrorCode,
  VisaCopyAccess,
};

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Reads the same persisted key LanguageContext.tsx itself reads/writes -- see candidate-documents-client.ts's identical helper. */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const candidateVisaDecisionsClient: CandidateVisaDecisionsClient = createCandidateVisaDecisionsClient({
  apiClient,
  getLocale,
});

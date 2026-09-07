// Web configuration for the candidate consent client, wired to the real
// backend (shared/candidateConsent/realCandidateConsentClient.ts, calling
// shared/api-client.ts). Mirrors candidate-profile-client.ts's
// locale-reading convention exactly.
import { createCandidateConsentClient } from '../../../shared/candidateConsent/realCandidateConsentClient';
import type { CandidateConsentClient, CandidateConsentError, CandidateConsentErrorCode } from '../../../shared/candidateConsent/types';
import { apiClient } from './api-client';

export type { CandidateConsentClient, CandidateConsentError, CandidateConsentErrorCode };

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Reads the same persisted key LanguageContext.tsx itself reads/writes -- see auth-client.ts's identical helper. */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const candidateConsentClient: CandidateConsentClient = createCandidateConsentClient({ apiClient, getLocale });

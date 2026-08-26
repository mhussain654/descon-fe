// Web configuration for the candidate self-profile client, wired to the
// real backend (shared/candidateProfile/realCandidateProfileClient.ts,
// calling shared/api-client.ts). Mirrors auth-client.ts's locale-reading
// convention exactly.
import { createCandidateProfileClient } from '../../../shared/candidateProfile/realCandidateProfileClient';
import type { CandidateProfile, CandidateProfileClient, CandidateProfileError, CandidateProfileErrorCode } from '../../../shared/candidateProfile/types';
import { apiClient } from './api-client';

export type { CandidateProfile, CandidateProfileClient, CandidateProfileError, CandidateProfileErrorCode };

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Reads the same persisted key LanguageContext.tsx itself reads/writes -- see auth-client.ts's identical helper. */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const candidateProfileClient: CandidateProfileClient = createCandidateProfileClient({ apiClient, getLocale });

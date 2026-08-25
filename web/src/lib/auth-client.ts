// Web configuration for the candidate authentication client (MPS-F201,
// wired to the real MPS-201 backend). Mirrors mobile/src/lib/auth-client.ts
// exactly: the real MPS-201 implementation
// (../../../shared/auth/realCandidateAuthClient.ts, calling
// shared/api-client.ts) -- the mock
// (../../../shared/auth/candidateAuthClient.ts) now exists purely for
// dev-without-a-backend convenience and tests, never wired into the app
// (AGENTS.md: "Never silently fall back to mock data in production").
import { createCandidateAuthClient } from '../../../shared/auth/realCandidateAuthClient';
import type { CandidateAuthClient } from '../../../shared/auth/types';
import { apiClient } from './api-client';

export type {
  AuthError,
  AuthErrorCode,
  AuthSession,
  CandidateAuthClient,
  OtpChallenge,
} from '../../../shared/auth/types';

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Reads the same persisted key LanguageContext.tsx itself reads/writes -- a direct, synchronous read (not `document.documentElement.lang`, which only reflects the current language after that provider's own effect has run). */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const candidateAuthClient: CandidateAuthClient = createCandidateAuthClient({ apiClient, getLocale });

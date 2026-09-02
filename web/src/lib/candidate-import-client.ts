// Web configuration for the admin candidate-import client, wired to the
// real backend (shared/adminCandidateImport/realCandidateImportClient.ts).
// Admin-only, web-only (AGENTS.md/ticket: "Do not add admin features to the
// mobile application") -- there is no mobile equivalent of this file.
import { createCandidateImportClient } from '../../../shared/adminCandidateImport/realCandidateImportClient';
import type {
  CandidateImportClient,
  CandidateImportCommitResult,
  CandidateImportError,
  CandidateImportErrorCode,
  CandidateImportPreflightResult,
  CandidateImportRowError,
  CandidateImportTemplate,
} from '../../../shared/adminCandidateImport/types';
import { apiClient } from './api-client';
import { staffAuthClient } from './staff-auth-client';

export type {
  CandidateImportClient,
  CandidateImportCommitResult,
  CandidateImportError,
  CandidateImportErrorCode,
  CandidateImportPreflightResult,
  CandidateImportRowError,
  CandidateImportTemplate,
};

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Reads the same persisted key LanguageContext.tsx itself reads/writes -- see auth-client.ts's identical helper. The backend localizes row-error messages from this header, so it directly determines what staff see in the import result. */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const candidateImportClient: CandidateImportClient = createCandidateImportClient({
  apiClient,
  staffAuthClient,
  getLocale,
});

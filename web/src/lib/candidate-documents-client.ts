// Web configuration for the candidate document checklist/upload client,
// wired to the real backend (shared/candidateDocuments/realCandidateDocumentsClient.ts).
// Mirrors candidate-profile-client.ts's locale-reading convention exactly.
import { createCandidateDocumentsClient } from '../../../shared/candidateDocuments/realCandidateDocumentsClient';
import type {
  CandidateDocumentChecklistItem,
  CandidateDocumentContentType,
  CandidateDocumentDisplayStatus,
  CandidateDocumentMetadata,
  CandidateDocumentsClient,
  CandidateDocumentsError,
  CandidateDocumentsErrorCode,
  CandidateDocumentStatus,
} from '../../../shared/candidateDocuments/types';
import { apiClient } from './api-client';

export type {
  CandidateDocumentChecklistItem,
  CandidateDocumentContentType,
  CandidateDocumentDisplayStatus,
  CandidateDocumentMetadata,
  CandidateDocumentsClient,
  CandidateDocumentsError,
  CandidateDocumentsErrorCode,
  CandidateDocumentStatus,
};

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Reads the same persisted key LanguageContext.tsx itself reads/writes -- see auth-client.ts's identical helper. */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const candidateDocumentsClient: CandidateDocumentsClient = createCandidateDocumentsClient({
  apiClient,
  getLocale,
});

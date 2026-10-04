// Mobile configuration for the candidate document checklist/upload client
// (mirrors web/src/lib/candidate-documents-client.ts exactly). Wires the
// real backend (shared/candidateDocuments/realCandidateDocumentsClient.ts).
import { createCandidateDocumentsClient } from '../../../shared/candidateDocuments/realCandidateDocumentsClient';
import type {
  CandidateDocumentChecklistItem,
  CandidateDocumentContentType,
  CandidateDocumentDisplayStatus,
  CandidateDocumentFile,
  CandidateDocumentMetadata,
  CandidateDocumentsClient,
  CandidateDocumentsError,
  CandidateDocumentsErrorCode,
  CandidateDocumentStatus,
  DocumentAccess,
  DocumentAccessDisposition,
  DocumentAccessError,
  DocumentAccessErrorCode,
} from '../../../shared/candidateDocuments/types';
import { getCachedLanguage } from '../contexts/LanguageContext';
import { apiClient } from './api-client';

export type {
  CandidateDocumentChecklistItem,
  CandidateDocumentContentType,
  CandidateDocumentDisplayStatus,
  CandidateDocumentFile,
  CandidateDocumentMetadata,
  CandidateDocumentsClient,
  CandidateDocumentsError,
  CandidateDocumentsErrorCode,
  CandidateDocumentStatus,
  DocumentAccess,
  DocumentAccessDisposition,
  DocumentAccessError,
  DocumentAccessErrorCode,
};

export const candidateDocumentsClient: CandidateDocumentsClient = createCandidateDocumentsClient({
  apiClient,
  // getCachedLanguage is exported from a plain .jsx file, so TS widens its
  // return type to `string` -- see mobile/src/lib/auth-client.ts's identical comment.
  getLocale: () => getCachedLanguage() as 'en' | 'ur',
});

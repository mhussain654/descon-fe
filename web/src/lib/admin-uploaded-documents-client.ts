// Web configuration for the uploaded-documents client (shared/adminUploadedDocuments).
import { createUploadedDocumentsClient } from '../../../shared/adminUploadedDocuments/realUploadedDocumentsClient';
import type { UploadedDocumentsClient } from '../../../shared/adminUploadedDocuments/types';
import { apiClient } from './api-client';
import { staffAuthClient } from './staff-auth-client';

export type { UploadedDocument, UploadedDocumentsError } from '../../../shared/adminUploadedDocuments/types';

function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem('descon.language') === 'ur' ? 'ur' : 'en';
}

export const adminUploadedDocumentsClient: UploadedDocumentsClient = createUploadedDocumentsClient({
  apiClient,
  staffAuthClient,
  getLocale,
});

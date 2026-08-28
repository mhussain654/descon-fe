// Web configuration for the admin document-review client, wired to the real
// backend (shared/adminDocumentReviews/realAdminDocumentReviewsClient.ts).
// Admin-only, web-only (ticket: "This task is web portal only") -- there is
// no mobile equivalent of this file.
import { createAdminDocumentReviewsClient } from '../../../shared/adminDocumentReviews/realAdminDocumentReviewsClient';
import type {
  AdminDocumentReviewError,
  AdminDocumentReviewErrorCode,
  AdminDocumentReviewsClient,
  DocumentAccess,
  DocumentReviewQueueFilters,
  DocumentReviewQueueItem,
  DocumentReviewQueuePage,
  DocumentReviewQueueResult,
  DocumentSubmissionDetail,
  ReviewDecisionResult,
  SubmissionDocument,
} from '../../../shared/adminDocumentReviews/types';
import { apiClient } from './api-client';
import { staffAuthClient } from './staff-auth-client';

export type {
  AdminDocumentReviewError,
  AdminDocumentReviewErrorCode,
  AdminDocumentReviewsClient,
  DocumentAccess,
  DocumentReviewQueueFilters,
  DocumentReviewQueueItem,
  DocumentReviewQueuePage,
  DocumentReviewQueueResult,
  DocumentSubmissionDetail,
  ReviewDecisionResult,
  SubmissionDocument,
};

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Reads the same persisted key LanguageContext.tsx itself reads/writes -- same helper as candidate-import-client.ts. The backend localizes country/project/craft/document names and messages from this header. */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const adminDocumentReviewsClient: AdminDocumentReviewsClient = createAdminDocumentReviewsClient({
  apiClient,
  staffAuthClient,
  getLocale,
});

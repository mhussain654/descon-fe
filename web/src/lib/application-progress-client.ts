// Web configuration for the candidate application-progress/document-
// submission client, wired to the real backend
// (shared/applicationProgress/realApplicationProgressClient.ts). Mirrors
// candidate-documents-client.ts's locale-reading convention exactly.
import { createApplicationProgressClient } from '../../../shared/applicationProgress/realApplicationProgressClient';
import type {
  ApplicationProgress,
  ApplicationProgressClient,
  ApplicationProgressDocuments,
  ApplicationProgressError,
  ApplicationProgressErrorCode,
  ApplicationSubmissionDisplayState,
  ApplicationSubmissionState,
  BlockingRequirement,
  BlockingRequirementDisplayReason,
  BlockingRequirementReason,
  DocumentSubmissionResult,
  WorkflowStage,
} from '../../../shared/applicationProgress/types';
import { apiClient } from './api-client';

export type {
  ApplicationProgress,
  ApplicationProgressClient,
  ApplicationProgressDocuments,
  ApplicationProgressError,
  ApplicationProgressErrorCode,
  ApplicationSubmissionDisplayState,
  ApplicationSubmissionState,
  BlockingRequirement,
  BlockingRequirementDisplayReason,
  BlockingRequirementReason,
  DocumentSubmissionResult,
  WorkflowStage,
};

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Reads the same persisted key LanguageContext.tsx itself reads/writes -- see candidate-documents-client.ts's identical helper. */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const applicationProgressClient: ApplicationProgressClient = createApplicationProgressClient({
  apiClient,
  getLocale,
});

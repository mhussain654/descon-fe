// Mobile configuration for the candidate application-progress/document-
// submission client (mirrors web/src/lib/application-progress-client.ts
// exactly). Wires the real backend
// (shared/applicationProgress/realApplicationProgressClient.ts).
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
import { getCachedLanguage } from '../contexts/LanguageContext';
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

export const applicationProgressClient: ApplicationProgressClient = createApplicationProgressClient({
  apiClient,
  // getCachedLanguage is exported from a plain .jsx file, so TS widens its
  // return type to `string` -- see mobile/src/lib/auth-client.ts's identical comment.
  getLocale: () => getCachedLanguage() as 'en' | 'ur',
});

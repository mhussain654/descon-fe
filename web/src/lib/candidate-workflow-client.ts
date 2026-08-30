// Web configuration for the candidate workflow-history client, wired to the
// real backend (shared/candidateWorkflow/realCandidateWorkflowClient.ts,
// calling shared/api-client.ts). Mirrors candidate-profile-client.ts's
// locale-reading convention exactly.
import { createCandidateWorkflowHistoryClient } from '../../../shared/candidateWorkflow/realCandidateWorkflowClient';
import type {
  CandidateWorkflowHistoryClient,
  QvcOutcomeCode,
  VisaOutcomeCode,
  WorkflowHistory,
  WorkflowHistoryError,
  WorkflowHistoryErrorCode,
  WorkflowHistoryItem,
  WorkflowHistoryStageReference,
  WorkflowTransitionDetails,
} from '../../../shared/candidateWorkflow/types';
import { apiClient } from './api-client';

export type {
  CandidateWorkflowHistoryClient,
  QvcOutcomeCode,
  VisaOutcomeCode,
  WorkflowHistory,
  WorkflowHistoryError,
  WorkflowHistoryErrorCode,
  WorkflowHistoryItem,
  WorkflowHistoryStageReference,
  WorkflowTransitionDetails,
};

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Reads the same persisted key LanguageContext.tsx itself reads/writes -- see candidate-profile-client.ts's identical helper. */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const candidateWorkflowClient: CandidateWorkflowHistoryClient = createCandidateWorkflowHistoryClient({
  apiClient,
  getLocale,
});

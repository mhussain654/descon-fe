// Mobile configuration for the candidate workflow-history client (mirrors
// web/src/lib/candidate-workflow-client.ts exactly). Wires the real backend
// (shared/candidateWorkflow/realCandidateWorkflowClient.ts, calling
// shared/api-client.ts's apiClient).
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
import { getCachedLanguage } from '../contexts/LanguageContext';
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

export const candidateWorkflowClient: CandidateWorkflowHistoryClient = createCandidateWorkflowHistoryClient({
  apiClient,
  // getCachedLanguage is exported from a plain .jsx file, so TS widens its
  // return type to `string` -- see mobile/src/lib/auth-client.ts's identical comment.
  getLocale: () => getCachedLanguage() as 'en' | 'ur',
});

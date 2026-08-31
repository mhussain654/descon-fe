// Web configuration for the admin workflow-transition client (MPS-F501
// Phase A), wired to the real backend
// (shared/adminWorkflow/realAdminWorkflowClient.ts). Admin-only, web-only --
// there is no mobile equivalent of this file, matching the established
// admin-document-reviews-client.ts precedent.
import { createAdminWorkflowClient } from '../../../shared/adminWorkflow/realAdminWorkflowClient';
import type {
  AdminQvcAttempt,
  AdminQvcAttempts,
  AdminWorkflowClient,
  AdminWorkflowError,
  AdminWorkflowErrorCode,
  AdminWorkflowState,
  AllowedWorkflowTransition,
  AllowedWorkflowTransitions,
  AdminWorkflowHistory,
  QvcActionResult,
  QvcAttemptStatus,
  QvcOutcomeCode,
  RecordQvcOutcomeInput,
  ScheduleQvcAppointmentInput,
  SubmitWorkflowTransitionInput,
  WorkflowActor,
  WorkflowHistoryItem,
  WorkflowProtectionRecord,
  WorkflowTimelineStage,
  WorkflowTransitionResult,
} from '../../../shared/adminWorkflow/types';
import { apiClient } from './api-client';
import { staffAuthClient } from './staff-auth-client';

export type {
  AdminQvcAttempt,
  AdminQvcAttempts,
  AdminWorkflowClient,
  AdminWorkflowError,
  AdminWorkflowErrorCode,
  AdminWorkflowState,
  AllowedWorkflowTransition,
  AllowedWorkflowTransitions,
  AdminWorkflowHistory,
  QvcActionResult,
  QvcAttemptStatus,
  QvcOutcomeCode,
  RecordQvcOutcomeInput,
  ScheduleQvcAppointmentInput,
  SubmitWorkflowTransitionInput,
  WorkflowActor,
  WorkflowHistoryItem,
  WorkflowProtectionRecord,
  WorkflowTimelineStage,
  WorkflowTransitionResult,
};

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Reads the same persisted key LanguageContext.tsx itself reads/writes -- same helper as admin-document-reviews-client.ts. */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const adminWorkflowClient: AdminWorkflowClient = createAdminWorkflowClient({
  apiClient,
  staffAuthClient,
  getLocale,
});

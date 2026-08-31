// Web configuration for the admin workflow-transition client (MPS-F501
// Phase A), wired to the real backend
// (shared/adminWorkflow/realAdminWorkflowClient.ts). Admin-only, web-only --
// there is no mobile equivalent of this file, matching the established
// admin-document-reviews-client.ts precedent.
import { createAdminWorkflowClient } from '../../../shared/adminWorkflow/realAdminWorkflowClient';
import type {
  AdminFlightDetail,
  AdminFlightDetailShow,
  AdminQvcAttempt,
  AdminQvcAttempts,
  AdminVisaDecision,
  AdminVisaDecisions,
  AdminWorkflowClient,
  AdminWorkflowError,
  AdminWorkflowErrorCode,
  AdminWorkflowState,
  AllowedWorkflowTransition,
  AllowedWorkflowTransitions,
  AdminWorkflowHistory,
  FlightDetailResult,
  FlightTicketAccessResult,
  MobilizeFlightDetailInput,
  QvcActionResult,
  QvcAttemptStatus,
  QvcOutcomeCode,
  RecordFlightDetailParams,
  RecordQvcOutcomeInput,
  RecordVisaDecisionParams,
  ScheduleQvcAppointmentInput,
  SubmitWorkflowTransitionInput,
  VisaCopyAccessResult,
  VisaDecisionResult,
  VisaOutcomeCode,
  VisaRejectionReasonCode,
  WorkflowActor,
  WorkflowHistoryItem,
  WorkflowProtectionRecord,
  WorkflowTimelineStage,
  WorkflowTransitionResult,
} from '../../../shared/adminWorkflow/types';
import { apiClient } from './api-client';
import { staffAuthClient } from './staff-auth-client';

export type {
  AdminFlightDetail,
  AdminFlightDetailShow,
  AdminQvcAttempt,
  AdminQvcAttempts,
  AdminVisaDecision,
  AdminVisaDecisions,
  AdminWorkflowClient,
  AdminWorkflowError,
  AdminWorkflowErrorCode,
  AdminWorkflowState,
  AllowedWorkflowTransition,
  AllowedWorkflowTransitions,
  AdminWorkflowHistory,
  FlightDetailResult,
  FlightTicketAccessResult,
  MobilizeFlightDetailInput,
  QvcActionResult,
  QvcAttemptStatus,
  QvcOutcomeCode,
  RecordFlightDetailParams,
  RecordQvcOutcomeInput,
  RecordVisaDecisionParams,
  ScheduleQvcAppointmentInput,
  SubmitWorkflowTransitionInput,
  VisaCopyAccessResult,
  VisaDecisionResult,
  VisaOutcomeCode,
  VisaRejectionReasonCode,
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

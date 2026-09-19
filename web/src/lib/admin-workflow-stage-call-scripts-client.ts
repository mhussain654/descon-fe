// Web configuration for the admin workflow-stage call scripts client,
// wired to the real backend
// (shared/adminWorkflowStageCallScripts/realAdminWorkflowStageCallScriptsClient.ts).
// Admin-only, web-only (AGENTS.md: "administrative workflows remain
// web-focused") -- there is no mobile equivalent of this file.
import { createAdminWorkflowStageCallScriptsClient } from '../../../shared/adminWorkflowStageCallScripts/realAdminWorkflowStageCallScriptsClient';
import type {
  AdminWorkflowStageCallScriptsClient,
  WorkflowStageCallScript,
  WorkflowStageCallScriptActorRef,
  WorkflowStageCallScriptError,
  WorkflowStageCallScriptErrorCode,
  WorkflowStageCallScriptUpdateInput,
} from '../../../shared/adminWorkflowStageCallScripts/types';
import { apiClient } from './api-client';
import { staffAuthClient } from './staff-auth-client';

export type {
  AdminWorkflowStageCallScriptsClient,
  WorkflowStageCallScript,
  WorkflowStageCallScriptActorRef,
  WorkflowStageCallScriptError,
  WorkflowStageCallScriptErrorCode,
  WorkflowStageCallScriptUpdateInput,
};

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Reads the same persisted key LanguageContext.tsx itself reads/writes -- see admin-audit-events-client.ts's identical helper. The backend localizes response messages from this header. */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const adminWorkflowStageCallScriptsClient: AdminWorkflowStageCallScriptsClient = createAdminWorkflowStageCallScriptsClient({
  apiClient,
  staffAuthClient,
  getLocale,
});

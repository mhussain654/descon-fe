// Admin workflow-stage AI call script types (MPS-708/MPS-F706), wired to
// the real backend documented in descon-be's openapi.yaml:
//   GET   /api/v1/admin/workflow_stage_call_scripts
//   PATCH /api/v1/admin/workflow_stage_call_scripts/{workflow_stage_code}
//
// Index+update only -- there is no create/destroy route: the row set is
// fixed to WorkflowStage::CANONICAL_STAGES and seeded up front for the
// stages where a call plausibly makes sense (not necessarily all 15). A
// stage without a seeded row simply never appears in the list; PATCHing an
// unseeded stage code 404s (the backend never creates one on the fly).
//
// Web-only (AGENTS.md: "administrative workflows remain web-focused").
import type { CanonicalWorkflowStageCode } from '../adminWorkflow/canonicalStages';

export interface WorkflowStageCallScriptActorRef {
  id: string;
  role: string;
}

/**
 * `announcementEn`/`announcementUr` -- the actual call always speaks in the
 * *candidate's own* preferred language, selecting between these two at call
 * time (falling back to `announcementEn` if the Urdu wording isn't ready
 * yet), so a stage needs both, not a single language_code tag. Mirrors
 * AiCalls::Prompts::ScenarioPrompt's existing bilingual opening_line
 * pattern for the 4 admin-triggered scenarios.
 */
export interface WorkflowStageCallScript {
  workflowStageCode: CanonicalWorkflowStageCode;
  announcementEn: string;
  /** May be blank if the Urdu wording isn't ready yet. */
  announcementUr?: string;
  active: boolean;
  updatedBy?: WorkflowStageCallScriptActorRef;
  updatedAt: string;
}

export interface WorkflowStageCallScriptUpdateInput {
  announcementEn: string;
  announcementUr: string;
  active: boolean;
}

export type WorkflowStageCallScriptErrorCode =
  | 'VALIDATION_FAILED'
  | 'FORBIDDEN'
  | 'INACTIVE_ACCOUNT'
  | 'SESSION_EXPIRED'
  | 'NOT_FOUND'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface WorkflowStageCallScriptError {
  code: WorkflowStageCallScriptErrorCode;
  /** Already-localized server message, when the backend provided one. */
  message?: string;
  field?: string;
}

export interface AdminWorkflowStageCallScriptsClient {
  listWorkflowStageCallScripts(): Promise<WorkflowStageCallScript[]>;
  updateWorkflowStageCallScript(
    workflowStageCode: CanonicalWorkflowStageCode,
    input: WorkflowStageCallScriptUpdateInput
  ): Promise<WorkflowStageCallScript>;
}

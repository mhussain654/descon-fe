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
export interface WorkflowStageCallScriptActorRef {
  id: string;
  role: string;
}

/**
 * `voiceId` is the RoboCall voice played when a candidate enters the stage:
 * a fixed pre-recorded voice, the only thing sent for the call. A stage with
 * no voice places no call. (The backend still returns the announcement
 * wording the retired ElevenLabs provider used; nothing here reads it.)
 */
export interface WorkflowStageCallScript {
  /** One of the backend's workflow stage codes (see shared/adminCandidates/workflowStageLabels.ts). */
  workflowStageCode: string;
  /** Absent until an admin sets one -- no call is placed for the stage meanwhile. */
  voiceId?: string;
  active: boolean;
  updatedBy?: WorkflowStageCallScriptActorRef;
  updatedAt: string;
}

export interface WorkflowStageCallScriptUpdateInput {
  /** Blank clears the voice. */
  voiceId: string;
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
    workflowStageCode: string,
    input: WorkflowStageCallScriptUpdateInput
  ): Promise<WorkflowStageCallScript>;
}

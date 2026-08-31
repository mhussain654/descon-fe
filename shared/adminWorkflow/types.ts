// Types for the staff/admin workflow-transition feature (MPS-F501 Phase A),
// matching descon-be's merged admin workflow contract field-for-field
// (camelCased) -- see openapi.yaml's
// /api/v1/admin/candidates/{candidate_id}/workflow_state|workflow_history|
// workflow_transitions paths, and app/controllers/api/v1/admin/
// candidate_workflow_{states,histories,transitions}_controller.rb. Do not
// add a field here the backend doesn't actually return, and do not invent
// the QVC/protection evidence shape ahead of the MPS-504/MPS-506 backend
// contract landing (see WorkflowTransitionDetails's comment below).

export type WorkflowStageStatus = 'completed' | 'current' | 'pending';

export interface WorkflowTimelineStage {
  code: string;
  name: string;
  position: number;
  status: WorkflowStageStatus;
  startedAt?: string;
  completedAt?: string;
}

export interface AdminWorkflowState {
  candidateId: string;
  assignmentId: string | null;
  candidateStatus: string;
  currentStage: WorkflowTimelineStage | null;
  timeline: WorkflowTimelineStage[];
  completedCount: number;
  totalCount: number;
  progressPercentage: number;
  updatedAt: string | null;
}

export interface AllowedWorkflowTransition {
  code: string;
  name: string;
  position: number;
  requiredFields: string[];
  allowed: boolean;
  blockingReasons: string[];
}

export interface AllowedWorkflowTransitions {
  candidateId: string;
  updatedAt: string | null;
  allowedNextTransitions: AllowedWorkflowTransition[];
}

/** Known staff role codes (User::STAFF_ROLE_CODES), reusing the exact same vocabulary as shared/adminDocumentReviews/types.ts's ReviewerRole -- this is the same role enum, not a parallel one. */
export type WorkflowActorRole = 'admin' | 'hr' | 'mps' | 'finance' | 'management';
export type WorkflowActorDisplayRole = WorkflowActorRole | 'unknown';

/** Safe actor identity -- the backend has no staff display-name field, so `role` (translated client-side) is the entire extent of "who did this" the contract provides. Never a personal name or email. */
export interface WorkflowActor {
  id: string;
  role: WorkflowActorDisplayRole;
}

/**
 * Every stage-evidence field the backend's WorkflowTransitionEvidence/
 * WorkflowTransitionHistoryDetails schema defines. Phase A never *submits*
 * any of these (the Qatar BU transition carries no evidence at all) -- they
 * exist here only because the same `details` shape is returned on history
 * entries for stages this build doesn't yet have a form for. The QVC/visa/
 * protection/flight fields are read-only display fields until the
 * MPS-504/MPS-506 backend contract is merged and verified; do not build a
 * submission form around them yet (ticket: "Do not invent the QVC or
 * protection payload before that backend contract is merged.").
 */
export interface WorkflowTransitionDetails {
  source?: string;
  appointmentDate?: string;
  qvcOutcomeCode?: 'approved' | 're_medical_required' | 'rejected';
  qvcOutcomeDate?: string;
  visaOutcomeCode?: 'issued' | 'rejected';
  visaOutcomeDate?: string;
  appearedForProtectionOn?: string;
  protectedOn?: string;
  flightReference?: string;
  flightDate?: string;
  mobilizedOn?: string;
}

export interface WorkflowStageReference {
  code: string;
  name: string;
  position: number;
}

export interface WorkflowHistoryItem {
  fromStage: WorkflowStageReference | null;
  toStage: WorkflowStageReference;
  occurredAt: string;
  reasonCode: string | null;
  details: WorkflowTransitionDetails | null;
  /** Present on the admin history/transition-result response; never on the candidate's own workflow_history (a candidate never sees who performed a transition). */
  actor?: WorkflowActor | null;
}

export interface AdminWorkflowHistory {
  candidateId: string;
  assignmentId: string | null;
  history: WorkflowHistoryItem[];
  updatedAt: string | null;
}

export interface WorkflowTransitionResult {
  workflow: AdminWorkflowState;
  transition: WorkflowHistoryItem;
}

export interface SubmitWorkflowTransitionInput {
  candidateId: string;
  toStageCode: string;
  /** Required by the backend specifically for `documents_shared_with_qatar_bu` (validated server-side) -- always send it when the current stage is known, since it protects every transition against a stale-state race, not only that one. */
  expectedCurrentStageCode?: string;
  reasonCode?: string;
  note?: string;
  idempotencyKey: string;
}

export type AdminWorkflowErrorCode =
  | 'VALIDATION_ERROR'
  | 'WORKFLOW_TRANSITION_STALE'
  | 'WORKFLOW_TRANSITION_PREREQUISITE_MISSING'
  | 'IDEMPOTENCY_CONFLICT'
  | 'MISSING_IDEMPOTENCY_KEY'
  | 'INVALID_IDEMPOTENCY_KEY'
  | 'IDEMPOTENCY_IN_PROGRESS'
  | 'INACTIVE_ACCOUNT'
  | 'SESSION_EXPIRED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface WorkflowTransitionPrerequisiteDetails {
  toStageCode?: string;
  requiredFields: string[];
  blockingReasons: string[];
}

export interface AdminWorkflowError {
  code: AdminWorkflowErrorCode;
  message?: string;
  field?: string;
  retryAfterSeconds?: number;
  /** Present only for WORKFLOW_TRANSITION_PREREQUISITE_MISSING (422 `workflow_transition_prerequisite_missing`). */
  prerequisite?: WorkflowTransitionPrerequisiteDetails;
}

export interface AdminWorkflowClient {
  getWorkflowState(candidateId: string): Promise<AdminWorkflowState>;
  getAllowedTransitions(candidateId: string): Promise<AllowedWorkflowTransitions>;
  getWorkflowHistory(candidateId: string): Promise<AdminWorkflowHistory>;
  submitTransition(input: SubmitWorkflowTransitionInput): Promise<WorkflowTransitionResult>;
}

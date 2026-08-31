// Types for the staff/admin workflow-transition feature (MPS-F501 Phase A/B),
// matching descon-be's merged admin workflow contract field-for-field
// (camelCased) -- see openapi.yaml's
// /api/v1/admin/candidates/{candidate_id}/workflow_state|workflow_history|
// workflow_transitions|qvc_attempts paths, and app/controllers/api/v1/admin/
// candidate_workflow_{states,histories,transitions}_controller.rb and
// candidate_qvc_attempts_controller.rb (merged PR #24, MPS-504/MPS-506). Do
// not add a field here the backend doesn't actually return.

export type WorkflowStageStatus = 'completed' | 'current' | 'pending';

export interface WorkflowTimelineStage {
  code: string;
  name: string;
  position: number;
  status: WorkflowStageStatus;
  startedAt?: string;
  completedAt?: string;
}

/** The candidate's current protection record, from the workflow-state snapshot's `protection` key -- there is no dedicated protection endpoint (unlike QVC), so this snapshot is the only source of "what's already been recorded" for the Protection panel. */
export interface WorkflowProtectionRecord {
  id: string;
  appearedOn: string | null;
  appearedRecordedAt: string | null;
  protectedOn: string | null;
  readyToFlyAt: string | null;
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
  /** Null until a protection appearance has been recorded. */
  protection: WorkflowProtectionRecord | null;
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
 * WorkflowTransitionHistoryDetails schema defines, returned on history
 * entries for every stage (`details`). Visa/flight/mobilization fields
 * remain read-only display fields here -- MPS-505/MPS-507 (their own
 * dedicated backend contracts) aren't merged yet, so this build still
 * doesn't submit a form for them (ticket: "Do not implement visa, flight or
 * mobilization forms yet; those remain blocked until MPS-505 + MPS-507
 * merge."). QVC and protection evidence are now submitted for real -- see
 * `ScheduleQvcAppointmentInput`/`RecordQvcOutcomeInput` and
 * `SubmitWorkflowTransitionInput.evidence` below.
 */
export interface WorkflowTransitionDetails {
  source?: string;
  appointmentDate?: string;
  /** `re_medical` is the value the backend actually stores/returns (CandidateQvcAttempt::OUTCOME_CODES); `re_medical_required` is only an accepted *input* alias, never a returned value. */
  qvcOutcomeCode?: 'approved' | 're_medical' | 'rejected';
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
  /** Stage-specific evidence fields (snake_case backend field names as keys, e.g. `appeared_for_protection_on`/`protected_on`), per descon-be's WorkflowTransitionEvidence contract. Empty/omitted for evidence-free transitions like Qatar BU sharing. */
  evidence?: Record<string, string>;
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

// QVC (medical exam) attempts -- a dedicated resource
// (candidate_qvc_attempts_controller.rb, merged PR #24), unlike protection
// which has no dedicated endpoint and is read from AdminWorkflowState's
// `protection` field / recorded via the generic submitTransition above.

/** The value the backend actually stores/returns for a completed attempt; `null` while an attempt is still open (scheduled, no outcome recorded yet) and no-show is handled by the separate `noShow` flag. */
export type QvcOutcomeCode = 'approved' | 're_medical' | 'rejected';
export type QvcAttemptStatus = QvcOutcomeCode | 'scheduled' | 'no_show';

export interface AdminQvcAttempt {
  id: string;
  attemptNumber: number;
  appointmentDate: string;
  outcomeCode: QvcOutcomeCode | null;
  noShow: boolean;
  outcomeRecordedAt: string | null;
  status: QvcAttemptStatus;
  internalNote: string | null;
  scheduledBy: WorkflowActor | null;
  outcomeRecordedBy: WorkflowActor | null;
}

export interface AdminQvcAttempts {
  candidateId: string;
  assignmentId: string | null;
  qvcAttempts: AdminQvcAttempt[];
  updatedAt: string | null;
}

export interface ScheduleQvcAppointmentInput {
  candidateId: string;
  appointmentDate: string;
  expectedCurrentStageCode?: string;
  note?: string;
  idempotencyKey: string;
}

export interface RecordQvcOutcomeInput {
  candidateId: string;
  qvcAttemptId: string;
  /** Omit (leave undefined) when `noShow` is true -- the backend rejects setting both. */
  outcomeCode?: QvcOutcomeCode;
  noShow?: boolean;
  expectedCurrentStageCode?: string;
  note?: string;
  idempotencyKey: string;
}

/**
 * The backend's schedule/outcome response is a discriminated union
 * (`AdminTransitionResultSerializer` when the action also advanced the
 * workflow stage, `AdminQvcAttemptResultSerializer` when it only affected
 * the attempt without a stage change, e.g. a re_medical follow-up staying
 * at `qvc_completed_outcome_received`) -- normalized here to one shape with
 * whichever side actually applied populated and the other null, so callers
 * don't need to branch on which serializer responded.
 */
export interface QvcActionResult {
  workflow: AdminWorkflowState;
  transition: WorkflowHistoryItem | null;
  qvcAttempt: AdminQvcAttempt | null;
}

export interface AdminWorkflowClient {
  getWorkflowState(candidateId: string): Promise<AdminWorkflowState>;
  getAllowedTransitions(candidateId: string): Promise<AllowedWorkflowTransitions>;
  getWorkflowHistory(candidateId: string): Promise<AdminWorkflowHistory>;
  submitTransition(input: SubmitWorkflowTransitionInput): Promise<WorkflowTransitionResult>;
  getQvcAttempts(candidateId: string): Promise<AdminQvcAttempts>;
  scheduleQvcAppointment(input: ScheduleQvcAppointmentInput): Promise<QvcActionResult>;
  recordQvcOutcome(input: RecordQvcOutcomeInput): Promise<QvcActionResult>;
}

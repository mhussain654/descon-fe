// Candidate workflow-history types (ticket: MPS-501), shared by web and
// mobile, wired to the real backend documented in descon-be's openapi.yaml:
//   GET /api/v1/candidate/workflow_history
//
// This is a separate resource from `shared/applicationProgress/types.ts`'s
// `ApplicationProgressWorkflow.timeline` (the current-state snapshot with
// per-stage started_at/completed_at): this module exposes the individual
// stage-to-stage transition log, including QVC/visa outcome evidence that
// only ever appears on the transition that recorded it, not on the
// snapshot's timeline. Platform-independent only, matching the sibling
// shared/ modules.

export type QvcOutcomeCode = 'approved' | 're_medical_required' | 'rejected';
export type VisaOutcomeCode = 'issued' | 'rejected';

/**
 * Evidence captured on a specific stage transition (openapi.yaml's
 * `WorkflowTransitionHistoryDetails`). Every field is optional -- only the
 * fields relevant to the transition's destination stage are ever present.
 * Never fabricate a missing field; render only what the backend actually
 * returned for that transition.
 */
export interface WorkflowTransitionDetails {
  appointmentDate?: string;
  qvcOutcomeCode?: QvcOutcomeCode;
  qvcOutcomeDate?: string;
  visaOutcomeCode?: VisaOutcomeCode;
  visaOutcomeDate?: string;
  appearedForProtectionOn?: string;
  protectedOn?: string;
  flightReference?: string;
  flightDate?: string;
  mobilizedOn?: string;
}

export interface WorkflowHistoryStageReference {
  code: string;
  /** Already localized server-side. */
  name: string;
  position: number;
}

export interface WorkflowHistoryItem {
  /** Null for the very first entry (registration itself has no "from" stage). */
  fromStage: WorkflowHistoryStageReference | null;
  toStage: WorkflowHistoryStageReference;
  /** ISO 8601. */
  occurredAt: string;
  reasonCode: string | null;
  details: WorkflowTransitionDetails | null;
}

export interface WorkflowHistory {
  /** Oldest first, matching the backend's own chronological ordering. */
  items: WorkflowHistoryItem[];
  /** ISO 8601, or null when the candidate has no current assignment yet. */
  updatedAt: string | null;
}

export type WorkflowHistoryErrorCode =
  | 'SESSION_EXPIRED'
  /** 403 `inactive_account` -- ends the candidate session, never shown as a generic permission error. */
  | 'INACTIVE_ACCOUNT'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface WorkflowHistoryError {
  code: WorkflowHistoryErrorCode;
  retryAfterSeconds?: number;
}

export interface CandidateWorkflowHistoryClient {
  /** The candidate's own session access token -- the only thing that determines whose history comes back; there is no id parameter to tamper with. */
  getWorkflowHistory(accessToken: string): Promise<WorkflowHistory>;
}

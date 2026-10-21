// Candidate voice call types (MPS-F706), wired to the real backend documented
// in descon-be's openapi.yaml:
//   GET  /api/v1/admin/candidates/{candidate_id}/ai_calls
//   POST /api/v1/admin/candidates/{candidate_id}/ai_calls
//
// Index+create only -- a call's outcome is written only by the post-call
// webhook/reconciliation job, never through this API (see the backend
// controller's own doc comment). The history is every outbound call the
// candidate had: placed by hand, automatic (workflow stage) and bulk.
//
// Web-only (AGENTS.md: "administrative workflows remain web-focused").

/** What started a call: an admin placing it by hand, the candidate entering a workflow stage, or a bulk batch. */
export type AdminAiCallTrigger = 'manual' | 'automatic' | 'bulk';

/** The recorded voice that was played. The names are only known while the call type still exists. */
export interface AdminAiCallVoice {
  voiceId: string;
  nameEn?: string;
  nameUr?: string;
}

export type AdminAiCallDirection = 'inbound' | 'outbound';

/** Matches CandidateAiCall::STATUSES. */
export type AdminAiCallStatus = 'requested' | 'queued' | 'ringing' | 'in_progress' | 'processing' | 'completed' | 'failed' | 'cancelled';

/** Matches CandidateAiCall::TERMINAL_STATUSES -- once a call reaches one of these, its status/outcome are final and there is nothing left to poll for. */
export const AI_CALL_TERMINAL_STATUSES: readonly AdminAiCallStatus[] = ['completed', 'failed', 'cancelled'];

export function isTerminalAiCallStatus(status: AdminAiCallStatus): boolean {
  return (AI_CALL_TERMINAL_STATUSES as readonly string[]).includes(status);
}

export type AdminAiCallOutcome = 'answered' | 'not_answered' | 'callback_required';

/** Matches AiCalls::OutcomeMapper's fixed outcome_reason values. */
export type AdminAiCallOutcomeReason =
  | 'resolved'
  | 'unresolved'
  | 'candidate_requested'
  | 'agent_escalation'
  | 'busy'
  | 'no_answer'
  | 'voicemail'
  | 'provider_failure'
  | 'needs_manual_review';

/** Matches CandidateAiCall::VERIFICATION_STATUSES. */
export type AdminAiCallVerificationStatus = 'not_applicable' | 'pending' | 'verified' | 'failed' | 'skipped';

export interface AdminAiCallActorRef {
  id: string;
  role: string;
}

export interface AdminCandidateAiCall {
  id: string;
  direction: AdminAiCallDirection;
  callReason: string;
  trigger: AdminAiCallTrigger;
  /** Set for an automatic call: the stage the candidate entered. */
  workflowStageCode?: string;
  voice?: AdminAiCallVoice;
  languageCode: string;
  status: AdminAiCallStatus;
  triggeredBy?: AdminAiCallActorRef;
  outcome?: AdminAiCallOutcome;
  outcomeReason?: AdminAiCallOutcomeReason;
  verificationStatus: AdminAiCallVerificationStatus;
  summary?: string;
  startedAt?: string;
  answeredAt?: string;
  completedAt?: string;
  createdAt: string;
}

export type AdminCandidateAiCallErrorCode =
  | 'VALIDATION_FAILED'
  | 'FORBIDDEN'
  | 'INACTIVE_ACCOUNT'
  | 'SESSION_EXPIRED'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'MISSING_IDEMPOTENCY_KEY'
  | 'RATE_LIMITED'
  | 'PROVIDER_ERROR'
  | 'CALLING_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface AdminCandidateAiCallError {
  code: AdminCandidateAiCallErrorCode;
  /** Already-localized server message, when the backend provided one. */
  message?: string;
  field?: string;
  retryAfterSeconds?: number;
}

export interface AdminCandidateAiCallsClient {
  listCandidateAiCalls(candidateId: string): Promise<AdminCandidateAiCall[]>;
  triggerCandidateAiCall(candidateId: string, robocallVoiceId: string, idempotencyKey: string): Promise<AdminCandidateAiCall>;
}

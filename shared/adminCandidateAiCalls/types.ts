// Admin-triggered candidate AI voice call types (MPS-F706), wired to the
// real backend documented in descon-be's openapi.yaml:
//   GET  /api/v1/admin/candidates/{candidate_id}/ai_calls
//   POST /api/v1/admin/candidates/{candidate_id}/ai_calls
//
// Index+create only -- a call's outcome is written only by the post-call
// webhook/reconciliation job, never through this API (see the backend
// controller's own doc comment). This history is admin-triggered outbound
// calls only; inbound helpline calls and workflow-stage-triggered calls
// appear only in the cross-channel Communications log.
//
// Web-only (AGENTS.md: "administrative workflows remain web-focused").

/** Matches AiCalls::Prompts::ScenarioPromptRegistry::PROMPTS_BY_CALL_REASON.keys exactly -- the 4 admin-triggered scenarios. */
export type AdminAiCallReason =
  | 'missing_documents'
  | 'protection_appearance_reminder'
  | 'urgent_compliance_action'
  | 'flight_information';

export type AdminAiCallDirection = 'inbound' | 'outbound';

/** Matches CandidateAiCall::STATUSES. */
export type AdminAiCallStatus = 'requested' | 'queued' | 'ringing' | 'in_progress' | 'processing' | 'completed' | 'failed' | 'cancelled';

export type AdminAiCallOutcome = 'answered' | 'not_answered' | 'callback_required';

/** Matches CandidateAiCall::VERIFICATION_STATUSES. */
export type AdminAiCallVerificationStatus = 'not_applicable' | 'pending' | 'verified' | 'failed' | 'skipped';

export interface AdminAiCallActorRef {
  id: string;
  role: string;
}

export interface AdminCandidateAiCall {
  id: string;
  direction: AdminAiCallDirection;
  callReason: AdminAiCallReason;
  languageCode: string;
  status: AdminAiCallStatus;
  triggeredBy?: AdminAiCallActorRef;
  outcome?: AdminAiCallOutcome;
  outcomeReason?: string;
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
  triggerCandidateAiCall(candidateId: string, callReason: AdminAiCallReason, idempotencyKey: string): Promise<AdminCandidateAiCall>;
}

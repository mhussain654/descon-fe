// Candidate application-progress and document-submission types (ticket:
// "Candidate Application Progress and Document Submission"), shared by web
// and mobile, wired to the real backend documented in descon-be's
// openapi.yaml:
//   GET  /api/v1/candidate/application_progress
//   POST /api/v1/candidate/document_submissions
//
// Platform-independent only -- no browser or React Native types appear
// anywhere in this module, matching shared/candidateDocuments/types.ts.
import type { PaymentEligibility } from '../payments/types';

export type ApplicationSubmissionState =
  | 'no_assignment'
  | 'no_requirements'
  | 'incomplete'
  | 'ready'
  | 'submitted'
  | 'partially_verified'
  | 'verified'
  | 'changes_required';

/**
 * `'unknown'` is not a real backend value -- it's what an unrecognized
 * future submission state gets normalized to at the client boundary (see
 * realApplicationProgressClient.ts's `toSubmissionState`), so the UI has a
 * safe, non-actionable state to render instead of crashing or showing a raw
 * code (ticket: "Treat unknown future states safely and never display raw
 * codes.").
 */
export type ApplicationSubmissionDisplayState = ApplicationSubmissionState | 'unknown';

export type BlockingRequirementReason = 'missing' | 'rejected';
export type BlockingRequirementDisplayReason = BlockingRequirementReason | 'unknown';

export interface BlockingRequirement {
  requirementCode: string;
  /** Already localized server-side per the request's X-Locale -- render directly, never substitute a hardcoded frontend name. */
  name: string;
  reason: BlockingRequirementDisplayReason;
}

export interface WorkflowStage {
  code: string;
  /** Already localized server-side. */
  name: string;
}

export type WorkflowTimelineStageStatus = 'completed' | 'current' | 'pending';

/**
 * One of the 15 canonical stages of the real, backend-authoritative
 * candidate workflow (registered -> ... -> mobilized), from
 * `CandidateWorkflowTimelineStage` (openapi.yaml). This is the single
 * source of truth for the candidate's progress through the whole
 * onboarding/mobilization pipeline -- never inferred or re-derived on the
 * frontend from document-submission state (ticket MPS-501: "Do not infer
 * downstream workflow stages from document submission state").
 */
export interface WorkflowTimelineStage {
  code: string;
  /** Already localized server-side. */
  name: string;
  /** 1-15, matching the canonical stage order. */
  position: number;
  status: WorkflowTimelineStageStatus;
  /** ISO 8601. Present only when `status` is `'current'` (or, for a terminal/completed workflow, may also be absent -- always render conditionally, never assume presence from `status` alone). */
  startedAt: string | null;
  /** ISO 8601. Present only when `status` is `'completed'`. */
  completedAt: string | null;
}

export interface ApplicationProgressWorkflow {
  timeline: WorkflowTimelineStage[];
  completedCount: number;
  totalCount: number;
  progressPercentage: number;
  /** ISO 8601, or null when the candidate has no current assignment yet. */
  updatedAt: string | null;
}

export interface ApplicationProgressDocuments {
  requiredTotal: number;
  missing: number;
  uploaded: number;
  pendingReview: number;
  verified: number;
  rejected: number;
  submittedTotal: number;
  /** Presentation only -- never used to independently decide submission eligibility (ticket: "Frontend calculations may format values for presentation, but must not independently decide: Submission eligibility..."). */
  completionPercentage: number;
  /** The ONLY signal that gates showing an enabled submit action -- never inferred from document counts or statuses. */
  canSubmit: boolean;
  submissionState: ApplicationSubmissionDisplayState;
  blockingRequirements: BlockingRequirement[];
}

export interface ApplicationProgress {
  candidateStatus: string;
  /** Null when the candidate has no current assignment. */
  currentWorkflowStage: WorkflowStage | null;
  /** The real, backend-computed 15-stage workflow snapshot (MPS-501) -- the sole source for rendering the Status screen's timeline and the Dashboard's current-stage summary. */
  workflow: ApplicationProgressWorkflow;
  documents: ApplicationProgressDocuments;
  /** Same eligibility/latest-payment shape as GET /candidate/payment (MPS-F601) -- kept in sync here purely so other screens can read it without a second fetch; the dedicated payment page/journey is still the source of truth for acting on it. */
  payment: PaymentEligibility;
}

export interface DocumentSubmissionResultDocuments {
  requiredTotal: number;
  pendingReview: number;
  canSubmit: boolean;
}

export interface DocumentSubmissionResult {
  /** Already-localized server confirmation message. */
  message: string;
  submissionId: string;
  /** ISO 8601 timestamp. */
  submittedAt: string;
  submissionState: ApplicationSubmissionDisplayState;
  documents: DocumentSubmissionResultDocuments;
}

export type ApplicationProgressErrorCode =
  | 'SESSION_EXPIRED'
  /** 403 `inactive_account` -- ends the candidate session, never shown as a generic permission error. */
  | 'INACTIVE_ACCOUNT'
  | 'NO_CURRENT_ASSIGNMENT'
  | 'NO_DOCUMENT_REQUIREMENTS'
  /** 422 `documents_incomplete` -- refresh progress and show the blocking (missing) documents. */
  | 'DOCUMENTS_INCOMPLETE'
  /** 422 `documents_rejected` -- refresh progress and direct the candidate to replacement actions. */
  | 'DOCUMENTS_REJECTED'
  | 'SUBMISSION_NOT_ALLOWED'
  /** 422 `already_submitted` -- refresh progress and show the current submitted state, not an error banner. */
  | 'ALREADY_SUBMITTED'
  /** 409 `idempotency_conflict` -- the same key was reused for a different request, or replayed after the underlying state changed. Never presented as success; requires a fresh key. */
  | 'CONFLICT'
  /** 409 `idempotency_in_progress` -- an identical request is still being processed; not an error to retry immediately with a new key. */
  | 'IN_PROGRESS'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface ApplicationProgressError {
  code: ApplicationProgressErrorCode;
  /** Already-localized server message, when the backend provided one (every 422/409 code does). */
  message?: string;
  retryAfterSeconds?: number;
  /** Present for DOCUMENTS_INCOMPLETE/DOCUMENTS_REJECTED -- the same shape as ApplicationProgressDocuments.blockingRequirements. A progress refetch remains the authoritative source once it resolves. */
  blockingRequirements?: BlockingRequirement[];
}

export interface SubmitDocumentsParams {
  accessToken: string;
  idempotencyKey: string;
}

export interface ApplicationProgressClient {
  /** The candidate's own session access token -- the only thing that determines whose progress comes back; there is no id parameter to tamper with. */
  getProgress(accessToken: string): Promise<ApplicationProgress>;
  /** Empty request body -- never sends a candidate id, assignment id, document id, or requirement code. */
  submitDocuments(params: SubmitDocumentsParams): Promise<DocumentSubmissionResult>;
}

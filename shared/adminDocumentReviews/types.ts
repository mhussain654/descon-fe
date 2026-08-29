// Types for the admin/HR document-review workspace (MPS-F402), matching
// descon-be's merged admin-review contract field-for-field (camelCased) --
// see app/serializers/admin/*.rb and app/controllers/api/v1/admin/*.rb in
// descon-be. Do not add a field here that the backend doesn't actually
// return; do not guess from the prototype.

/** The four review states the backend can report today (Admin::DocumentReviewQueueParams::REVIEW_STATES). */
export type ReviewState = 'pending_review' | 'partially_reviewed' | 'changes_required' | 'verified';

/** Adds 'unknown' for a future backend state this build doesn't recognize yet -- never rendered as the raw code. */
export type ReviewDisplayState = ReviewState | 'unknown';

/** Per-document status (CandidateDocument::API_STATUS_MAP). Distinct from the submission-level ReviewState above. */
export type DocumentStatus = 'uploaded' | 'pending_review' | 'verified' | 'rejected';

export type DocumentDisplayStatus = DocumentStatus | 'unknown';

export interface ReferenceCode {
  code: string;
  name: string;
}

export interface ReviewSummary {
  pendingReview: number;
  verified: number;
  rejected: number;
  requiredTotal: number;
  reviewState: ReviewDisplayState;
}

export interface QueueCandidate {
  id: string;
  fullName: string;
}

export interface QueueAssignment {
  id: string;
  referenceNumber: string;
  country: ReferenceCode;
  project: ReferenceCode;
  craft: ReferenceCode;
}

export interface DocumentReviewQueueItem {
  id: string;
  candidate: QueueCandidate;
  assignment: QueueAssignment;
  submittedAt: string;
  review: ReviewSummary;
}

/** Known staff role codes (User::STAFF_ROLE_CODES). 'unknown' is the safe fallback for a future role this build doesn't recognize yet -- never rendered as a raw code. */
export type ReviewerRole = 'admin' | 'hr' | 'mps' | 'finance' | 'management';
export type ReviewerDisplayRole = ReviewerRole | 'unknown';

/** Safe reviewer identity -- the backend has no staff display-name field, so `role` (translated client-side) is the entire extent of "reviewer information" the contract provides. Never a personal name or email. */
export interface ReviewerInfo {
  id: string;
  role: ReviewerDisplayRole;
}

export interface SubmissionDocument {
  id: string;
  requirementCode: string;
  required: boolean;
  name: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  uploadedAt: string;
  status: DocumentDisplayStatus;
  verifiedAt?: string;
  rejectionReason?: string;
  /** Present once the document has been reviewed (verified or rejected). */
  reviewer?: ReviewerInfo;
}

export interface DocumentSubmissionDetail {
  id: string;
  candidate: QueueCandidate;
  assignment: QueueAssignment;
  submittedAt: string;
  review: ReviewSummary;
  documents: SubmissionDocument[];
}

export interface QueuePagination {
  page: number;
  perPage: number;
  totalCount: number;
  totalPages: number;
}

/** Distinct-candidate counts per review bucket, scoped by every active filter except `status` -- present on every queue result (ticket: "Staff compliance summary" / "Counts that reconcile with the review queue"). */
export interface DocumentReviewQueueSummary {
  pendingReview: number;
  verified: number;
  rejected: number;
  expiredPcc: number;
  nearExpiryPcc: number;
}

export interface DocumentReviewQueueResult {
  items: DocumentReviewQueueItem[];
  pagination: QueuePagination;
  summary: DocumentReviewQueueSummary;
}

/**
 * `'rejected'`, `'expired_pcc'`, and `'near_expiry_pcc'` are filter-only
 * values -- they narrow the queue but never appear as a `ReviewState` on a
 * returned item's `review.reviewState` (rejected items report
 * `'changes_required'` there; PCC-expiry state is a separate document-level
 * concept from review state).
 */
export type QueueStatusFilter = ReviewState | 'rejected' | 'expired_pcc' | 'near_expiry_pcc';

export interface DocumentReviewQueueFilters {
  /** Omit to use the backend's own default (`pending_review, partially_reviewed`) -- never invent a different client-side default. */
  status?: QueueStatusFilter[];
  /** ISO 8601 datetime (not just a date) -- the backend parses with `Time.iso8601`. */
  submittedFrom?: string;
  submittedTo?: string;
  candidatePublicId?: string;
  projectCode?: string;
  countryCode?: string;
}

export interface DocumentReviewQueuePage {
  number?: number;
  size?: number;
}

/** A short-lived, single-use credential for previewing one document. Never persist beyond the current preview session (see the ticket's "Secure document access" rules). */
export interface DocumentAccess {
  documentId: string;
  url: string;
  /** ISO 8601 timestamp; the caller must request a fresh access after this passes. */
  expiresAt: string;
}

export interface ReviewDecisionResult {
  document: SubmissionDocument;
  submission: {
    id: string;
    review: ReviewSummary;
  };
}

export type AdminDocumentReviewErrorCode =
  | 'MISSING_IDEMPOTENCY_KEY'
  | 'INVALID_IDEMPOTENCY_KEY'
  | 'REVIEW_NOT_ALLOWED'
  | 'DOCUMENT_SUBMISSION_NOT_FOUND'
  | 'CANDIDATE_DOCUMENT_NOT_FOUND'
  | 'DOCUMENT_ACCESS_FORBIDDEN'
  | 'DOCUMENT_ATTACHMENT_MISSING'
  | 'DOCUMENT_NOT_PENDING_REVIEW'
  | 'DOCUMENT_ALREADY_REVIEWED'
  | 'REJECTION_REASON_REQUIRED'
  | 'REJECTION_REASON_INVALID'
  | 'IDEMPOTENCY_CONFLICT'
  | 'IDEMPOTENCY_IN_PROGRESS'
  | 'INACTIVE_ACCOUNT'
  | 'SESSION_EXPIRED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface AdminDocumentReviewError {
  code: AdminDocumentReviewErrorCode;
  message?: string;
  field?: string;
  retryAfterSeconds?: number;
}

export interface AdminDocumentReviewsClient {
  getQueue(filters: DocumentReviewQueueFilters, page: DocumentReviewQueuePage): Promise<DocumentReviewQueueResult>;
  getSubmission(submissionId: string): Promise<DocumentSubmissionDetail>;
  requestDocumentAccess(documentId: string): Promise<DocumentAccess>;
  verifyDocument(documentId: string, idempotencyKey: string): Promise<ReviewDecisionResult>;
  rejectDocument(documentId: string, reason: string, idempotencyKey: string): Promise<ReviewDecisionResult>;
}

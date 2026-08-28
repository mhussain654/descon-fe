// Maps every AdminDocumentReviewErrorCode to the shared translation key that
// explains it, same pattern as shared/applicationProgress/errorMessages.ts.
// The backend's own `message` (already localized per X-Locale) is preferred
// when present -- these keys are the fallback for when it isn't, and the
// only source of copy for codes that never carry a message (network/offline/
// unknown).
import type { AdminDocumentReviewErrorCode } from './types';

export const ADMIN_DOCUMENT_REVIEW_ERROR_KEYS: Record<AdminDocumentReviewErrorCode, string> = {
  MISSING_IDEMPOTENCY_KEY: 'somethingWentWrong',
  INVALID_IDEMPOTENCY_KEY: 'somethingWentWrong',
  REVIEW_NOT_ALLOWED: 'staffAuthForbiddenError',
  DOCUMENT_SUBMISSION_NOT_FOUND: 'adminDocumentReviewSubmissionNotFoundError',
  CANDIDATE_DOCUMENT_NOT_FOUND: 'adminDocumentReviewDocumentNotFoundError',
  DOCUMENT_ACCESS_FORBIDDEN: 'staffAuthForbiddenError',
  DOCUMENT_ATTACHMENT_MISSING: 'adminDocumentReviewAttachmentMissingError',
  DOCUMENT_NOT_PENDING_REVIEW: 'adminDocumentReviewNotPendingError',
  DOCUMENT_ALREADY_REVIEWED: 'adminDocumentReviewAlreadyReviewedError',
  REJECTION_REASON_REQUIRED: 'adminDocumentReviewRejectionReasonRequiredError',
  REJECTION_REASON_INVALID: 'adminDocumentReviewRejectionReasonInvalidError',
  IDEMPOTENCY_CONFLICT: 'adminDocumentReviewIdempotencyConflictError',
  IDEMPOTENCY_IN_PROGRESS: 'adminDocumentReviewIdempotencyInProgressError',
  INACTIVE_ACCOUNT: 'staffAuthInactiveAccountError',
  SESSION_EXPIRED: 'dsSessionExpiredDescription',
  FORBIDDEN: 'staffAuthForbiddenError',
  VALIDATION_ERROR: 'somethingWentWrong',
  RATE_LIMITED: 'authRateLimitedError',
  NETWORK_ERROR: 'somethingWentWrong',
  OFFLINE: 'dsOfflineDescription',
  SERVER_ERROR: 'somethingWentWrong',
  UNKNOWN: 'somethingWentWrong',
};

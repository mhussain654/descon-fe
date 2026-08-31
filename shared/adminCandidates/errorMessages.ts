// Maps every AdminCandidateErrorCode to the shared translation key that
// explains it, same pattern as shared/adminDocumentReviews/errorMessages.ts.
// The backend's own `message` (already localized per X-Locale) is preferred
// when present -- these keys are the fallback for when it isn't, and the
// only source of copy for codes that never carry a message (network/
// offline/unknown).
import type { AdminCandidateErrorCode } from './types';

export const ADMIN_CANDIDATE_ERROR_KEYS: Record<AdminCandidateErrorCode, string> = {
  VALIDATION_ERROR: 'somethingWentWrong',
  DUPLICATE_CNIC: 'adminCandidateDuplicateCnicError',
  DUPLICATE_PASSPORT_NUMBER: 'adminCandidateDuplicatePassportNumberError',
  DUPLICATE_REFERENCE_NUMBER: 'adminCandidateDuplicateReferenceNumberError',
  ASSIGNMENT_FIELD_LOCKED: 'adminCandidateAssignmentFieldLockedError',
  STALE_CANDIDATE: 'adminCandidateStaleError',
  IDEMPOTENCY_CONFLICT: 'adminCandidateIdempotencyConflictError',
  MISSING_IDEMPOTENCY_KEY: 'somethingWentWrong',
  INVALID_IDEMPOTENCY_KEY: 'somethingWentWrong',
  IDEMPOTENCY_IN_PROGRESS: 'adminCandidateIdempotencyInProgressError',
  INACTIVE_ACCOUNT: 'staffAuthInactiveAccountError',
  SESSION_EXPIRED: 'dsSessionExpiredDescription',
  FORBIDDEN: 'staffAuthForbiddenError',
  NOT_FOUND: 'adminCandidateNotFoundError',
  RATE_LIMITED: 'authRateLimitedError',
  NETWORK_ERROR: 'somethingWentWrong',
  OFFLINE: 'dsOfflineDescription',
  SERVER_ERROR: 'somethingWentWrong',
  UNKNOWN: 'somethingWentWrong',
};

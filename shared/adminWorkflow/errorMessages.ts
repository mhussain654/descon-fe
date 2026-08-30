// Maps every AdminWorkflowErrorCode to the shared translation key that
// explains it, same pattern as shared/adminDocumentReviews/errorMessages.ts.
// The backend's own `message` (already localized per X-Locale) is preferred
// when present -- these keys are the fallback for when it isn't, and the
// only source of copy for codes that never carry a message (network/
// offline/unknown).
import type { AdminWorkflowErrorCode } from './types';

export const ADMIN_WORKFLOW_ERROR_KEYS: Record<AdminWorkflowErrorCode, string> = {
  VALIDATION_ERROR: 'somethingWentWrong',
  WORKFLOW_TRANSITION_STALE: 'adminWorkflowTransitionStaleError',
  WORKFLOW_TRANSITION_PREREQUISITE_MISSING: 'adminWorkflowPrerequisiteMissingError',
  IDEMPOTENCY_CONFLICT: 'adminWorkflowIdempotencyConflictError',
  MISSING_IDEMPOTENCY_KEY: 'somethingWentWrong',
  INVALID_IDEMPOTENCY_KEY: 'somethingWentWrong',
  IDEMPOTENCY_IN_PROGRESS: 'adminWorkflowIdempotencyInProgressError',
  INACTIVE_ACCOUNT: 'staffAuthInactiveAccountError',
  SESSION_EXPIRED: 'dsSessionExpiredDescription',
  FORBIDDEN: 'staffAuthForbiddenError',
  RATE_LIMITED: 'authRateLimitedError',
  NETWORK_ERROR: 'somethingWentWrong',
  OFFLINE: 'dsOfflineDescription',
  SERVER_ERROR: 'somethingWentWrong',
  UNKNOWN: 'somethingWentWrong',
};

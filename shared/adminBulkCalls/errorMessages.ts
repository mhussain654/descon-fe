// Maps every AdminBulkCallErrorCode to the shared translation key that explains
// it (same pattern as shared/adminCandidateAiCalls/errorMessages.ts). A
// server-provided, already-localized message is preferred when present; these
// are the fallback.
import type { AdminBulkCallErrorCode } from './types';

export const BULK_CALL_ERROR_KEYS: Record<AdminBulkCallErrorCode, string> = {
  VALIDATION_FAILED: 'somethingWentWrong',
  FORBIDDEN: 'dsForbiddenDescription',
  INACTIVE_ACCOUNT: 'staffAuthInactiveAccountError',
  SESSION_EXPIRED: 'dsSessionExpiredDescription',
  NOT_FOUND: 'somethingWentWrong',
  NOTHING_TO_CALL: 'adminBulkCallErrorNothingToCall',
  OUTSIDE_CALLING_HOURS: 'adminBulkCallErrorOutsideHours',
  DAILY_LIMIT_REACHED: 'adminBulkCallErrorDailyLimit',
  CALLING_DISABLED: 'adminBulkCallErrorCallingDisabled',
  IDEMPOTENCY_CONFLICT: 'adminCandidateAiCallIdempotencyConflictError',
  MISSING_IDEMPOTENCY_KEY: 'somethingWentWrong',
  RATE_LIMITED: 'authRateLimitedError',
  NETWORK_ERROR: 'networkError',
  OFFLINE: 'dsOfflineDescription',
  SERVER_ERROR: 'somethingWentWrong',
  UNKNOWN: 'somethingWentWrong',
};

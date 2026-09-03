// Maps every AdminPaymentErrorCode to the shared translation key that
// explains it, same rationale/pattern as
// shared/adminCandidateImport/errorMessages.ts. Server-provided messages
// (e.g. a specific validation or correction-not-allowed reason) are
// preferred over these when present -- these are the fallback.
import type { AdminPaymentErrorCode } from './types';

export const ADMIN_PAYMENT_ERROR_KEYS: Record<AdminPaymentErrorCode, string> = {
  NOT_FOUND: 'adminFinancePaymentNotFoundDescription',
  VALIDATION_FAILED: 'adminFinancePaymentValidationError',
  CORRECTION_NOT_ALLOWED: 'adminFinancePaymentCorrectionNotAllowedError',
  STALE_PAYMENT: 'adminFinancePaymentStaleError',
  CONFLICT: 'adminFinancePaymentConflictError',
  MISSING_IDEMPOTENCY_KEY: 'somethingWentWrong',
  BAD_REQUEST: 'somethingWentWrong',
  FORBIDDEN: 'dsForbiddenDescription',
  INACTIVE_ACCOUNT: 'staffAuthInactiveAccountError',
  SESSION_EXPIRED: 'dsSessionExpiredDescription',
  RATE_LIMITED: 'authRateLimitedError',
  NETWORK_ERROR: 'somethingWentWrong',
  OFFLINE: 'dsOfflineDescription',
  SERVER_ERROR: 'somethingWentWrong',
  UNKNOWN: 'somethingWentWrong',
};

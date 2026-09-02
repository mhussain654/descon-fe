// Maps every PaymentErrorCode to the shared translation key that explains
// it, same pattern as shared/applicationProgress/errorMessages.ts. The
// backend's own `message` (already localized per X-Locale) is preferred
// when present -- these keys are the fallback.
import type { PaymentErrorCode } from './types';

export const PAYMENT_ERROR_KEYS: Record<PaymentErrorCode, string> = {
  NOT_ELIGIBLE: 'paymentNotEligibleError',
  CHECKOUT_UNAVAILABLE: 'paymentProviderUnavailableError',
  IDEMPOTENCY_CONFLICT: 'paymentIdempotencyConflictError',
  MISSING_IDEMPOTENCY_KEY: 'somethingWentWrong',
  INVALID_IDEMPOTENCY_KEY: 'somethingWentWrong',
  IDEMPOTENCY_IN_PROGRESS: 'paymentIdempotencyInProgressError',
  INACTIVE_ACCOUNT: 'candidateProfileInactiveAccountDescription',
  SESSION_EXPIRED: 'dsSessionExpiredDescription',
  FORBIDDEN: 'staffAuthForbiddenError',
  RATE_LIMITED: 'authRateLimitedError',
  NETWORK_ERROR: 'somethingWentWrong',
  OFFLINE: 'dsOfflineDescription',
  SERVER_ERROR: 'somethingWentWrong',
  UNKNOWN: 'somethingWentWrong',
};

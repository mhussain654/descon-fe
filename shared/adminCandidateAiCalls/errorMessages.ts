// Maps every AdminCandidateAiCallErrorCode to the shared translation key
// that explains it, same rationale/pattern as
// shared/adminAuditEvents/errorMessages.ts. Server-provided messages are
// preferred over these when present -- these are the fallback.
import type { AdminCandidateAiCallErrorCode } from './types';

export const CANDIDATE_AI_CALL_ERROR_KEYS: Record<AdminCandidateAiCallErrorCode, string> = {
  VALIDATION_FAILED: 'somethingWentWrong',
  FORBIDDEN: 'dsForbiddenDescription',
  INACTIVE_ACCOUNT: 'staffAuthInactiveAccountError',
  SESSION_EXPIRED: 'dsSessionExpiredDescription',
  NOT_FOUND: 'somethingWentWrong',
  IDEMPOTENCY_CONFLICT: 'somethingWentWrong',
  MISSING_IDEMPOTENCY_KEY: 'somethingWentWrong',
  RATE_LIMITED: 'authRateLimitedError',
  PROVIDER_ERROR: 'adminCandidateAiCallProviderError',
  CALLING_UNAVAILABLE: 'adminCandidateAiCallUnavailable',
  NETWORK_ERROR: 'networkError',
  OFFLINE: 'dsOfflineDescription',
  SERVER_ERROR: 'somethingWentWrong',
  UNKNOWN: 'somethingWentWrong',
};

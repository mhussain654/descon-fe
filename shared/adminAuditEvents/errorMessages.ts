// Maps every AuditEventErrorCode to the shared translation key that
// explains it, same rationale/pattern as
// shared/adminPayments/errorMessages.ts. Server-provided messages are
// preferred over these when present -- these are the fallback.
import type { AuditEventErrorCode } from './types';

export const AUDIT_EVENT_ERROR_KEYS: Record<AuditEventErrorCode, string> = {
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

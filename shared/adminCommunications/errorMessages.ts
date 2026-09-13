// Maps every CommunicationErrorCode to the shared translation key that
// explains it, same rationale/pattern as
// shared/adminAuditEvents/errorMessages.ts. Server-provided messages are
// preferred over these when present -- these are the fallback.
import type { CommunicationErrorCode } from './types';

export const COMMUNICATION_ERROR_KEYS: Record<CommunicationErrorCode, string> = {
  BAD_REQUEST: 'somethingWentWrong',
  FORBIDDEN: 'dsForbiddenDescription',
  INACTIVE_ACCOUNT: 'staffAuthInactiveAccountError',
  SESSION_EXPIRED: 'dsSessionExpiredDescription',
  RATE_LIMITED: 'authRateLimitedError',
  NETWORK_ERROR: 'networkError',
  OFFLINE: 'dsOfflineDescription',
  SERVER_ERROR: 'somethingWentWrong',
  UNKNOWN: 'somethingWentWrong',
};

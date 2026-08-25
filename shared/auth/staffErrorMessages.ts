// Maps every StaffAuthErrorCode to the shared translation key that explains
// it -- same rationale as errorMessages.ts's candidate-auth map: centralized
// once so a new error code can't ship without a required translation key
// attached to it (see staffErrorMessages.test.ts).
import type { StaffAuthErrorCode } from './staffTypes';

export const STAFF_AUTH_ERROR_KEYS: Record<StaffAuthErrorCode, string> = {
  INVALID_CREDENTIALS: 'staffAuthInvalidCredentialsError',
  INACTIVE_ACCOUNT: 'staffAuthInactiveAccountError',
  TOO_MANY_ATTEMPTS: 'staffAuthTooManyAttemptsError',
  SESSION_EXPIRED: 'dsSessionExpiredTitle',
  FORBIDDEN: 'staffAuthForbiddenError',
  OFFLINE: 'dsOfflineTitle',
  SERVICE_UNAVAILABLE: 'authServiceUnavailableError',
  NETWORK_ERROR: 'somethingWentWrong',
  UNKNOWN: 'somethingWentWrong',
};

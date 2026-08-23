// Maps every AuthErrorCode/CnicFieldError to the shared translation key that
// explains it. Centralized here (rather than duplicated per screen per
// platform) so web and mobile always show identical copy for identical
// error codes, and so a new error code can't ship without a required
// translation key attached to it (see errorMessages.test.ts).
import type { CnicFieldError } from './cnicOtpFlow';
import type { AuthErrorCode } from './types';

export const CNIC_FIELD_ERROR_KEYS: Record<CnicFieldError, string> = {
  REQUIRED: 'authCnicRequiredError',
  INVALID_FORMAT: 'authCnicFormatError',
};

export const AUTH_ERROR_KEYS: Record<AuthErrorCode, string> = {
  OTP_REQUEST_FAILED: 'authOtpRequestFailedError',
  OTP_INVALID: 'authOtpInvalidError',
  OTP_EXPIRED: 'authOtpExpiredError',
  // Handled as a dedicated state (see authOtpMaxAttemptsTitle/Description) rather than an inline field error, but a translation key still exists for consistency/fallback use.
  OTP_MAX_ATTEMPTS: 'authOtpMaxAttemptsTitle',
  RESEND_COOLDOWN: 'authResendAvailableInPrefix',
  CHALLENGE_NOT_FOUND: 'dsSessionExpiredTitle',
  SESSION_EXPIRED: 'dsSessionExpiredTitle',
  OFFLINE: 'dsOfflineTitle',
  SERVICE_UNAVAILABLE: 'authServiceUnavailableError',
  NETWORK_ERROR: 'somethingWentWrong',
  UNKNOWN: 'somethingWentWrong',
};

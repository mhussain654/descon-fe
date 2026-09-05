// Maps every MpsDashboardErrorCode to the shared translation key that
// explains it, same pattern as shared/adminAuditEvents/errorMessages.ts.
import type { MpsDashboardErrorCode } from './types';

export const MPS_DASHBOARD_ERROR_KEYS: Record<MpsDashboardErrorCode, string> = {
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

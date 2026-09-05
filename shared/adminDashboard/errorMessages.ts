// Maps every AdminDashboardErrorCode to the shared translation key that
// explains it, same pattern as shared/adminAuditEvents/errorMessages.ts.
import type { AdminDashboardErrorCode } from './types';

export const ADMIN_DASHBOARD_ERROR_KEYS: Record<AdminDashboardErrorCode, string> = {
  FORBIDDEN: 'dsForbiddenDescription',
  INACTIVE_ACCOUNT: 'staffAuthInactiveAccountError',
  SESSION_EXPIRED: 'dsSessionExpiredDescription',
  RATE_LIMITED: 'authRateLimitedError',
  NETWORK_ERROR: 'somethingWentWrong',
  OFFLINE: 'dsOfflineDescription',
  SERVER_ERROR: 'somethingWentWrong',
  UNKNOWN: 'somethingWentWrong',
};

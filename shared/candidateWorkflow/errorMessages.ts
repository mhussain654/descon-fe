// Maps every WorkflowHistoryErrorCode to the shared translation key that
// explains it, same rationale/pattern as shared/candidateProfile/errorMessages.ts.
import type { WorkflowHistoryErrorCode } from './types';

export const WORKFLOW_HISTORY_ERROR_KEYS: Record<WorkflowHistoryErrorCode, string> = {
  SESSION_EXPIRED: 'dsSessionExpiredDescription',
  INACTIVE_ACCOUNT: 'candidateProfileInactiveAccountDescription',
  FORBIDDEN: 'dsForbiddenDescription',
  RATE_LIMITED: 'authRateLimitedError',
  NETWORK_ERROR: 'somethingWentWrong',
  OFFLINE: 'dsOfflineDescription',
  SERVER_ERROR: 'somethingWentWrong',
  UNKNOWN: 'somethingWentWrong',
};

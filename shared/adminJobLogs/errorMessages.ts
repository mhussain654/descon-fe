// Maps every JobLogErrorCode to the shared translation key that explains it.
// Server-provided messages are preferred over these when present.
import type { JobLogErrorCode } from './types';

export const JOB_LOG_ERROR_KEYS: Record<JobLogErrorCode, string> = {
  BAD_REQUEST: 'adminJobLogsBadFilter',
  FORBIDDEN: 'dsForbiddenDescription',
  INACTIVE_ACCOUNT: 'staffAuthInactiveAccountError',
  SESSION_EXPIRED: 'dsSessionExpiredDescription',
  NETWORK_ERROR: 'networkError',
  OFFLINE: 'dsOfflineDescription',
  SERVER_ERROR: 'somethingWentWrong',
  UNKNOWN: 'somethingWentWrong',
};

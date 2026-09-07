// Maps every SystemBackupErrorCode to the shared translation key that
// explains it, same rationale/pattern as shared/adminAuditEvents/errorMessages.ts.
// Server-provided messages are preferred over these when present -- these
// are the fallback.
import type { SystemBackupErrorCode } from './types';

export const SYSTEM_BACKUP_ERROR_KEYS: Record<SystemBackupErrorCode, string> = {
  ARCHIVE_NOT_FOUND: 'adminSystemBackupArchiveNotFound',
  FORBIDDEN: 'dsForbiddenDescription',
  INACTIVE_ACCOUNT: 'staffAuthInactiveAccountError',
  SESSION_EXPIRED: 'dsSessionExpiredDescription',
  NETWORK_ERROR: 'networkError',
  OFFLINE: 'dsOfflineDescription',
  SERVER_ERROR: 'somethingWentWrong',
  UNKNOWN: 'somethingWentWrong',
};

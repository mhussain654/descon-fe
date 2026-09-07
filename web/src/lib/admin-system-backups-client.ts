// Web configuration for the admin database-backup browsing client, wired to
// the real backend (shared/adminSystemBackups/realAdminSystemBackupsClient.ts).
// Admin-only, web-only (AGENTS.md: "administrative workflows remain
// web-focused") -- there is no mobile equivalent of this file.
import { createAdminSystemBackupsClient } from '../../../shared/adminSystemBackups/realAdminSystemBackupsClient';
import type {
  AdminSystemBackupsClient,
  SystemBackup,
  SystemBackupAccess,
  SystemBackupError,
  SystemBackupErrorCode,
  SystemBackupListPage,
  SystemBackupListPagination,
  SystemBackupListResult,
} from '../../../shared/adminSystemBackups/types';
import { apiClient } from './api-client';
import { staffAuthClient } from './staff-auth-client';

export type {
  AdminSystemBackupsClient,
  SystemBackup,
  SystemBackupAccess,
  SystemBackupError,
  SystemBackupErrorCode,
  SystemBackupListPage,
  SystemBackupListPagination,
  SystemBackupListResult,
};

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Reads the same persisted key LanguageContext.tsx itself reads/writes -- see admin-payments-client.ts's identical helper. The backend localizes response messages from this header. */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const adminSystemBackupsClient: AdminSystemBackupsClient = createAdminSystemBackupsClient({
  apiClient,
  staffAuthClient,
  getLocale,
});

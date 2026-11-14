// Web configuration for the developer-only Job logs client, wired to the real
// backend (shared/adminJobLogs/realAdminJobLogsClient.ts). Web-only.
import { createAdminJobLogsClient } from '../../../shared/adminJobLogs/realAdminJobLogsClient';
import type {
  AdminJobLogsClient,
  JobLog,
  JobLogListError,
  JobLogListFilters,
  JobLogListPage,
  JobLogListResult,
  JobLogStatus,
} from '../../../shared/adminJobLogs/types';
import { apiClient } from './api-client';
import { staffAuthClient } from './staff-auth-client';

export type { AdminJobLogsClient, JobLog, JobLogListError, JobLogListFilters, JobLogListPage, JobLogListResult, JobLogStatus };

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Reads the same persisted key LanguageContext.tsx reads/writes. */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const adminJobLogsClient: AdminJobLogsClient = createAdminJobLogsClient({ apiClient, staffAuthClient, getLocale });

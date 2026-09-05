// Web configuration for the Management dashboard client, wired to the real
// backend (shared/adminManagementDashboard/realAdminManagementDashboardClient.ts).
// Admin-only, web-only (AGENTS.md: "administrative workflows remain
// web-focused") -- there is no mobile equivalent of this file.
import { createAdminManagementDashboardClient } from '../../../shared/adminManagementDashboard/realAdminManagementDashboardClient';
import type {
  ManagementDashboardClient,
  ManagementDashboardError,
  ManagementDashboardErrorCode,
  ManagementDashboardSummary,
  TrendGranularity,
} from '../../../shared/adminManagementDashboard/types';
import { apiClient } from './api-client';
import { staffAuthClient } from './staff-auth-client';

export type {
  ManagementDashboardClient,
  ManagementDashboardError,
  ManagementDashboardErrorCode,
  ManagementDashboardSummary,
  TrendGranularity,
};

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Reads the same persisted key LanguageContext.tsx itself reads/writes -- see admin-payments-client.ts's identical helper. */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const adminManagementDashboardClient: ManagementDashboardClient = createAdminManagementDashboardClient({
  apiClient,
  staffAuthClient,
  getLocale,
});

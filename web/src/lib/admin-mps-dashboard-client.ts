// Web configuration for the MPS dashboard client, wired to the real
// backend (shared/adminMpsDashboard/realAdminMpsDashboardClient.ts).
// Admin-only, web-only (AGENTS.md: "administrative workflows remain
// web-focused") -- there is no mobile equivalent of this file.
import { createAdminMpsDashboardClient } from '../../../shared/adminMpsDashboard/realAdminMpsDashboardClient';
import type {
  DelayedCases,
  MpsDashboardClient,
  MpsDashboardError,
  MpsDashboardErrorCode,
  MpsDashboardSummary,
  TrendGranularity,
} from '../../../shared/adminMpsDashboard/types';
import { apiClient } from './api-client';
import { staffAuthClient } from './staff-auth-client';

export type { DelayedCases, MpsDashboardClient, MpsDashboardError, MpsDashboardErrorCode, MpsDashboardSummary, TrendGranularity };

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Reads the same persisted key LanguageContext.tsx itself reads/writes -- see admin-payments-client.ts's identical helper. */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const adminMpsDashboardClient: MpsDashboardClient = createAdminMpsDashboardClient({
  apiClient,
  staffAuthClient,
  getLocale,
});

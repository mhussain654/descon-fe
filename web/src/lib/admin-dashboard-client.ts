// Web configuration for the admin dashboard client, wired to the real
// backend (shared/adminDashboard/realAdminDashboardClient.ts).
// Admin-only, web-only (AGENTS.md: "administrative workflows remain
// web-focused") -- there is no mobile equivalent of this file.
import { createAdminDashboardClient } from '../../../shared/adminDashboard/realAdminDashboardClient';
import type {
  AdminDashboardClient,
  AdminDashboardError,
  AdminDashboardErrorCode,
  AdminDashboardSummary,
  CandidateWorkload,
  PaymentSummaryRow,
} from '../../../shared/adminDashboard/types';
import { apiClient } from './api-client';
import { staffAuthClient } from './staff-auth-client';

export type { AdminDashboardClient, AdminDashboardError, AdminDashboardErrorCode, AdminDashboardSummary, CandidateWorkload, PaymentSummaryRow };

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Reads the same persisted key LanguageContext.tsx itself reads/writes -- see admin-payments-client.ts's identical helper. */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const adminDashboardClient: AdminDashboardClient = createAdminDashboardClient({
  apiClient,
  staffAuthClient,
  getLocale,
});

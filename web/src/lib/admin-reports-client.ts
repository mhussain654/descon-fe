// Web configuration for the admin MIS reports client, wired to the real
// backend (shared/adminReports/realAdminReportsClient.ts).
// Admin-only, web-only (AGENTS.md: "administrative workflows remain
// web-focused") -- there is no mobile equivalent of this file.
import { createAdminReportsClient } from '../../../shared/adminReports/realAdminReportsClient';
import type {
  AdminReportsClient,
  ConversionRow,
  CraftSummaryRow,
  MobilizationRow,
  MobilizationSummary,
  OutcomeTracking,
  ReportData,
  ReportDataParams,
  ReportError,
  ReportErrorCode,
  ReportExportFormat,
  ReportExportResult,
  ReportType,
  StatusSummaryRow,
  TrendGranularity,
  TrendPoint,
} from '../../../shared/adminReports/types';
import { apiClient } from './api-client';
import { staffAuthClient } from './staff-auth-client';

export type {
  AdminReportsClient,
  ConversionRow,
  CraftSummaryRow,
  MobilizationRow,
  MobilizationSummary,
  OutcomeTracking,
  ReportData,
  ReportDataParams,
  ReportError,
  ReportErrorCode,
  ReportExportFormat,
  ReportExportResult,
  ReportType,
  StatusSummaryRow,
  TrendGranularity,
  TrendPoint,
};

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Reads the same persisted key LanguageContext.tsx itself reads/writes -- see admin-payments-client.ts's identical helper. The backend localizes response messages/reference-data names from this header. */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const adminReportsClient: AdminReportsClient = createAdminReportsClient({
  apiClient,
  staffAuthClient,
  getLocale,
});

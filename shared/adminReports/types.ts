// MIS report catalogue types (MPS-804/MPS-805/MPS-806), wired to the real
// backend documented in descon-be's openapi.yaml:
//   GET /api/v1/admin/reports
//   GET /api/v1/admin/reports/{report_type}
//   GET /api/v1/admin/reports/{report_type}/export
//
// These row shapes are also reused by the MPS and Management dashboards
// (shared/adminMpsDashboard, shared/adminManagementDashboard), which surface
// the exact same aggregated data inline rather than duplicating it.
//
// Web-only (AGENTS.md: "administrative workflows remain web-focused").

/** One of the 15 canonical workflow stages, zero-filled -- see shared/adminWorkflow/canonicalStages.ts for the code enum and its translation keys. */
export interface StatusSummaryRow {
  code: string;
  position: number;
  count: number;
}

/** A country or project row within a MobilizationSummary -- `name` is already localized server-side per the request's X-Locale header. */
export interface MobilizationRow {
  code: string;
  name: string;
  count: number;
}

export interface MobilizationSummary {
  byCountry: MobilizationRow[];
  byProject: MobilizationRow[];
}

export interface CraftSummaryRow {
  code: string;
  name: string;
  total: number;
  mobilized: number;
}

/** Negative-outcome counts, scoped to every candidate's current assignment only. */
export interface OutcomeTracking {
  rejectedDocuments: number;
  qvcReMedical: number;
  qvcRejected: number;
  qvcNoShow: number;
  visaRejected: number;
}

/** One stage of the Docs -> Verified -> Mobilized funnel. `percentage` is of the total candidate count, not of the previous stage. */
export interface ConversionRow {
  code: string;
  count: number;
  percentage: number;
}

/** One bucket of the mobilization trend. `period` is an ISO 8601 date (the bucket's start). */
export interface TrendPoint {
  period: string;
  count: number;
}

export type TrendGranularity = 'daily' | 'weekly' | 'monthly';

export type ReportType = 'status_summary' | 'mobilization' | 'craft_summary' | 'outcome_tracking' | 'conversion' | 'trend';

export type ReportExportFormat = 'csv' | 'xlsx' | 'pdf';

/** Discriminated by `type` so a caller only ever destructures the shape that matches the report it asked for. */
export type ReportData =
  | { type: 'status_summary'; rows: StatusSummaryRow[] }
  | { type: 'mobilization'; summary: MobilizationSummary }
  | { type: 'craft_summary'; rows: CraftSummaryRow[] }
  | { type: 'outcome_tracking'; summary: OutcomeTracking }
  | { type: 'conversion'; rows: ConversionRow[] }
  | { type: 'trend'; rows: TrendPoint[] };

export interface ReportDataParams {
  /** Only meaningful for the `trend` report; ignored by every other report type. Defaults to `monthly` server-side. */
  granularity?: TrendGranularity;
}

export interface ReportExportResult {
  blob: Blob;
  filename: string;
}

export type ReportErrorCode =
  /** 400 -- an unknown report_type/format, or an unsupported granularity (a frontend contract-drift bug, not a scenario the UI should trigger by hand). */
  | 'BAD_REQUEST'
  | 'FORBIDDEN'
  | 'INACTIVE_ACCOUNT'
  | 'SESSION_EXPIRED'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface ReportError {
  code: ReportErrorCode;
  /** Already-localized server message, when the backend provided one. */
  message?: string;
  field?: string;
  retryAfterSeconds?: number;
}

export interface AdminReportsClient {
  listReportTypes(): Promise<ReportType[]>;
  getReportData(reportType: ReportType, params?: ReportDataParams): Promise<ReportData>;
  exportReport(reportType: ReportType, format: ReportExportFormat, params?: ReportDataParams): Promise<ReportExportResult>;
}

// MPS dashboard types (MPS-802), wired to the real backend documented in
// descon-be's openapi.yaml:
//   GET /api/v1/admin/mps_dashboard
//
// Reuses StatusSummaryRow, CraftSummaryRow, MobilizationSummary and
// TrendPoint from shared/adminReports/types.ts -- the same aggregated data
// shown inline here is also independently browsable/exportable via the
// reports catalogue.
//
// Web-only (AGENTS.md: "administrative workflows remain web-focused").
import type { ConversionRow, CraftSummaryRow, DashboardFilters, MobilizationSummary, StatusSummaryRow, TrendGranularity, TrendPoint } from '../adminReports/types';

export type { TrendGranularity };

/** Same shape every admin dashboard shares -- see DashboardFilters in shared/adminReports/types.ts. */
export type MpsDashboardFilters = DashboardFilters;

/** "Delayed"/"critical" thresholds (7/14 days in the current stage) are a documented backend implementation default, not a confirmed stakeholder value -- `critical` is also counted within `delayed`. */
export interface DelayedCases {
  delayed: number;
  critical: number;
}

/** The single most recently mobilized candidate in scope -- null when nothing has been mobilized yet. */
export interface LatestMobilization {
  candidateFullName: string;
  candidatePublicId: string;
  candidateAssignmentPublicId: string;
  referenceNumber: string;
  countryName: string;
  projectName: string;
  craftName: string;
  mobilizedAt: string;
}

export interface MpsDashboardSummary {
  workflowStageQueue: StatusSummaryRow[];
  delayedCases: DelayedCases;
  craftSummary: CraftSummaryRow[];
  mobilization: MobilizationSummary;
  mobilizationTrend: TrendPoint[];
  /** Reused unchanged from the Admin dashboard's own conversion_funnel -- same ConversionQuery, same real data. */
  conversionFunnel: ConversionRow[];
  latestMobilization: LatestMobilization | null;
}

export type MpsDashboardErrorCode =
  | 'BAD_REQUEST'
  | 'FORBIDDEN'
  | 'INACTIVE_ACCOUNT'
  | 'SESSION_EXPIRED'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface MpsDashboardError {
  code: MpsDashboardErrorCode;
  message?: string;
  retryAfterSeconds?: number;
}

export interface MpsDashboardClient {
  getDashboard(granularity?: TrendGranularity, filters?: MpsDashboardFilters): Promise<MpsDashboardSummary>;
}

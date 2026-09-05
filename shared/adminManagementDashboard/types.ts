// Management dashboard types (MPS-803), wired to the real backend
// documented in descon-be's openapi.yaml:
//   GET /api/v1/admin/management_dashboard
//
// Reuses ConversionRow, OutcomeTracking, MobilizationSummary and TrendPoint
// from shared/adminReports/types.ts -- the same aggregated data shown
// inline here is also independently browsable/exportable via the reports
// catalogue.
//
// Web-only (AGENTS.md: "administrative workflows remain web-focused").
import type { ConversionRow, MobilizationSummary, OutcomeTracking, TrendGranularity, TrendPoint } from '../adminReports/types';

export type { TrendGranularity };

export interface ManagementDashboardSummary {
  conversionFunnel: ConversionRow[];
  outcomeTracking: OutcomeTracking;
  mobilization: MobilizationSummary;
  mobilizationTrend: TrendPoint[];
}

export type ManagementDashboardErrorCode =
  | 'BAD_REQUEST'
  | 'FORBIDDEN'
  | 'INACTIVE_ACCOUNT'
  | 'SESSION_EXPIRED'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface ManagementDashboardError {
  code: ManagementDashboardErrorCode;
  message?: string;
  retryAfterSeconds?: number;
}

export interface ManagementDashboardClient {
  getDashboard(granularity?: TrendGranularity): Promise<ManagementDashboardSummary>;
}

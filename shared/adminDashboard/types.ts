// Admin dashboard types (MPS-801), wired to the real backend documented in
// descon-be's openapi.yaml:
//   GET /api/v1/admin/dashboard
//
// Reuses StatusSummaryRow from shared/adminReports/types.ts (the workflow
// stage queue) and DocumentReviewQueueSummary from
// shared/adminDocumentReviews/types.ts (the exact same shape already
// returned by the document review queue's own summary) rather than
// redefining either.
//
// Web-only (AGENTS.md: "administrative workflows remain web-focused").
import type { DocumentReviewQueueSummary } from '../adminDocumentReviews/types';
import type { ConversionRow, StatusSummaryRow } from '../adminReports/types';

export interface CandidateWorkload {
  totalActiveCandidates: number;
}

/** One payment status and its count, scoped to current assignments only. */
export interface PaymentSummaryRow {
  code: string;
  count: number;
}

export type RequiresAttentionCode = 'rejected_documents' | 'failed_payment' | 'overdue_qvc' | 'callback_required';

/** One cross-source exception count -- rejected documents, failed payments, overdue QVC appointments, or calls awaiting a callback. */
export interface RequiresAttentionRow {
  code: RequiresAttentionCode;
  count: number;
}

export type UpcomingActivityType = 'qvc_appointment' | 'flight_departure';

/** One QVC appointment or flight departure in the next 7 days. Protection appearances are not yet included -- see descon-be's UpcomingActivitiesQuery. */
export interface UpcomingActivityRow {
  type: UpcomingActivityType;
  occursOn: string;
  candidateAssignmentPublicId: string;
  referenceNumber: string;
}

export interface RecentlyUpdatedCandidateRow {
  candidateFullName: string;
  candidatePublicId: string;
  candidateAssignmentPublicId: string;
  referenceNumber: string;
  workflowStageCode: string;
  lastUpdatedAt: string;
}

/** One day's real event count for a sparkline-eligible KPI -- registrations/payments/mobilizations per day, not a point-in-time backlog size. Distinct from adminReports/types.ts's TrendPoint (a `period` bucket, not a single calendar `date`). */
export interface KpiTrendPoint {
  date: string;
  count: number;
}

export interface KpiTrends {
  activeCandidates: KpiTrendPoint[];
  paidPayments: KpiTrendPoint[];
  mobilized: KpiTrendPoint[];
}

export interface AdminDashboardSummary {
  candidateWorkload: CandidateWorkload;
  workflowStageQueue: StatusSummaryRow[];
  documentReviewQueue: DocumentReviewQueueSummary;
  paymentSummary: PaymentSummaryRow[];
  conversionFunnel: ConversionRow[];
  /** Null when no assignment in scope has more than one recorded workflow-stage transition yet. */
  averageStageDurationDays: number | null;
  requiresAttention: RequiresAttentionRow[];
  upcomingActivities: UpcomingActivityRow[];
  recentlyUpdatedCandidates: RecentlyUpdatedCandidateRow[];
  kpiTrends: KpiTrends;
}

export type AdminDashboardErrorCode =
  | 'FORBIDDEN'
  | 'INACTIVE_ACCOUNT'
  | 'SESSION_EXPIRED'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface AdminDashboardError {
  code: AdminDashboardErrorCode;
  message?: string;
  retryAfterSeconds?: number;
}

export interface AdminDashboardClient {
  getDashboard(): Promise<AdminDashboardSummary>;
}

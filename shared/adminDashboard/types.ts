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
import type { StatusSummaryRow } from '../adminReports/types';

export interface CandidateWorkload {
  totalActiveCandidates: number;
}

/** One payment status and its count, scoped to current assignments only. */
export interface PaymentSummaryRow {
  code: string;
  count: number;
}

export interface AdminDashboardSummary {
  candidateWorkload: CandidateWorkload;
  workflowStageQueue: StatusSummaryRow[];
  documentReviewQueue: DocumentReviewQueueSummary;
  paymentSummary: PaymentSummaryRow[];
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

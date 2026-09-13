// Candidate visa-decision types, wired to the real backend documented in
// descon-be's openapi.yaml:
//   GET  /api/v1/candidate/visa_decisions
//   POST /api/v1/candidate/visa_decisions/{visa_decision_id}/visa_copy_access
//
// The visa-copy-access endpoint is shared server-side between the admin and
// candidate flows (CandidateWorkflows::VisaCopyAccessService) -- this
// module is the candidate-facing half of that pair, mirroring
// shared/candidateFlightDetail/types.ts's flight-ticket equivalent exactly.

export type VisaDecisionOutcomeCode = 'issued' | 'rejected';

export interface CandidateVisaDecision {
  id: string;
  outcomeCode: VisaDecisionOutcomeCode;
  /** ISO 8601 date. */
  decisionDate: string;
  rejectionReasonCode: string | null;
  /** Whether a visa copy file was actually attached -- the ONLY signal that gates showing a download action; a rejected decision never has one. */
  visaCopyAttached: boolean;
  /** ISO 8601. */
  createdAt: string;
}

export interface VisaCopyAccess {
  visaDecisionId: string;
  /** A relative, Rails-internal path (`only_path: true`) -- resolve against the API origin, not the full base URL, before using it (see resolveDocumentAccessUrl.ts). */
  url: string;
  /** ISO 8601. */
  expiresAt: string;
}

export type CandidateVisaDecisionsErrorCode =
  | 'NOT_FOUND'
  /** 422 -- visa decision exists but has no attached copy file (e.g. a rejected decision). */
  | 'VISA_COPY_NOT_ATTACHED'
  | 'FORBIDDEN'
  | 'INACTIVE_ACCOUNT'
  | 'SESSION_EXPIRED'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface CandidateVisaDecisionsError {
  code: CandidateVisaDecisionsErrorCode;
  message?: string;
  retryAfterSeconds?: number;
}

export interface CandidateVisaDecisionsClient {
  /** Resolves to an empty list before any decision has been recorded -- not an error. */
  listVisaDecisions(accessToken: string): Promise<CandidateVisaDecision[]>;
  requestVisaCopyAccess(accessToken: string, visaDecisionId: string): Promise<VisaCopyAccess>;
}

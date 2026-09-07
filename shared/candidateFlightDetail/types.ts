// Candidate flight-detail types (MPS-507/MPS-F502), wired to the real
// backend documented in descon-be's openapi.yaml:
//   GET  /api/v1/candidate/flight_detail
//   POST /api/v1/candidate/flight_detail/ticket_access
//
// The ticket-access endpoint is shared server-side between the admin and
// candidate flows (CandidateWorkflows::FlightTicketAccessService) -- this
// module is the candidate-facing half of that pair; the admin-facing half
// already exists at web/src/features/admin/workflow's realAdminWorkflowClient.

export interface CandidateFlightDetail {
  id: string;
  /** Already localized where applicable server-side; free text otherwise. */
  airline: string;
  flightNumber: string;
  sector: string;
  /** ISO 8601. */
  flightDepartureAt: string;
  /** Whether a ticket file was actually attached -- the ONLY signal that gates showing a download action; never inferred from the workflow stage alone (a stage reaching flight_details_uploaded does not guarantee a file was attached). */
  ticketAttached: boolean;
  /** ISO 8601 date, or null before mobilization. */
  mobilizedOn: string | null;
  mobilized: boolean;
}

export interface FlightTicketAccess {
  flightDetailId: string;
  /** A relative, Rails-internal path (`only_path: true`) -- resolve against the API origin, not the full base URL, before using it (see resolveDocumentAccessUrl.ts). */
  url: string;
  /** ISO 8601. */
  expiresAt: string;
}

export type CandidateFlightDetailErrorCode =
  | 'NOT_FOUND'
  /** 422 -- flight detail exists but has no attached ticket file. */
  | 'TICKET_NOT_ATTACHED'
  | 'FORBIDDEN'
  | 'INACTIVE_ACCOUNT'
  | 'SESSION_EXPIRED'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface CandidateFlightDetailError {
  code: CandidateFlightDetailErrorCode;
  message?: string;
  retryAfterSeconds?: number;
}

export interface CandidateFlightDetailClient {
  /** Resolves to `null` before a flight detail has been recorded -- not an error. */
  getFlightDetail(accessToken: string): Promise<CandidateFlightDetail | null>;
  requestTicketAccess(accessToken: string): Promise<FlightTicketAccess>;
}

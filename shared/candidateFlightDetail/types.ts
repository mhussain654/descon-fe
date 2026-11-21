// Candidate flight-detail types (MPS-507/MPS-F502), wired to the real
// backend documented in descon-be's openapi.yaml:
//   GET  /api/v1/candidate/flight_detail
//   POST /api/v1/candidate/flight_detail/ticket_access
//   PUT  /api/v1/candidate/flight_detail/boarding_pass
//   POST /api/v1/candidate/flight_detail/boarding_pass_access
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
  /** The route, e.g. LHE-DOH; optional, null when staff left it blank. */
  sector: string | null;
  /** ISO 8601. */
  flightDepartureAt: string;
  /** Whether a ticket file was actually attached -- the ONLY signal that gates showing a download action; never inferred from the workflow stage alone (a stage reaching flight_details_uploaded does not guarantee a file was attached). */
  ticketAttached: boolean;
  /** ISO 8601 date, or null before mobilization. */
  mobilizedOn: string | null;
  mobilized: boolean;
  /** When the candidate uploaded their boarding pass photo (ISO 8601), or null before they do. */
  boardingPassUploadedAt: string | null;
  /** When the boarding pass may be uploaded; null from a backend that doesn't send it yet (treated as open). */
  boardingPassUpload: BoardingPassUploadWindow | null;
  /** Set when staff rejected the uploaded boarding pass; the candidate should upload a valid one. */
  boardingPassRejection: BoardingPassRejection | null;
}

/** Why staff rejected the candidate's boarding pass photo. The next upload clears it. */
export interface BoardingPassRejection {
  /** ISO 8601. */
  rejectedAt: string;
  /** Free text written by staff, shown as is. */
  reason: string;
}

/**
 * The boarding pass upload window: from 2 days before the flight's day to 2
 * days after it, as Pakistan calendar days. `state` is decided by the server
 * from Pakistan's date, so the app never relies on the phone's clock.
 */
export interface BoardingPassUploadWindow {
  /** YYYY-MM-DD */
  opensOn: string;
  /** YYYY-MM-DD */
  closesOn: string;
  state: 'not_yet_open' | 'open' | 'closed';
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
  /** 422 boarding pass upload validation; the backend's localized message is kept for display. */
  | 'MISSING_FILE'
  | 'EMPTY_FILE'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FILE_TYPE'
  /** 422 -- outside the upload window (2 days before to 2 days after the flight's day). */
  | 'BOARDING_PASS_UPLOAD_NOT_OPEN'
  | 'BOARDING_PASS_UPLOAD_CLOSED'
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
  /** A short-lived link to the boarding pass photo the candidate uploaded, so they can check it. */
  requestBoardingPassAccess(accessToken: string): Promise<FlightTicketAccess>;
  /** Uploads (or replaces) the boarding pass photo; resolves to the updated flight detail. */
  uploadBoardingPass(input: { accessToken: string; formData: FormData }): Promise<CandidateFlightDetail>;
}

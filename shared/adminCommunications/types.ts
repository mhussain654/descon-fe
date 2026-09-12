// Admin communications log types (MPS-F706), wired to the real backend
// documented in descon-be's openapi.yaml:
//   GET /api/v1/admin/communications
//
// Read-only by design -- there is no show, create, update, or destroy
// endpoint; every channel (SMS, email, notification, AI voice call) writes
// Communication rows through its own provider-specific service, never
// directly through this API. This client therefore only ever lists.
//
// Web-only (AGENTS.md: "administrative workflows remain web-focused").

/** A staff actor reference -- id + role only, matching every other admin serializer's convention. Absent for a system-initiated communication with no human actor. */
export interface CommunicationActorRef {
  id: string;
  role: string;
}

/** The candidate assignment a communication is about -- absent only for an inbound communication that never resolved to a known assignment (e.g. an unidentified inbound AI call). */
export interface CommunicationAssignmentRef {
  id: string;
  referenceNumber: string;
  candidateId: string;
}

/**
 * One row of the central cross-channel communications log. `channelCode`/
 * `directionCode`/`statusCode` are free-form on the backend (format-checked
 * only, no fixed enum) since each channel defines its own vocabulary --
 * never rendered as raw/untranslated prose here beyond a label lookup with
 * a humanized fallback (see communicationLabels.ts).
 */
export interface Communication {
  id: string;
  channelCode: string;
  directionCode: 'inbound' | 'outbound';
  statusCode: string;
  templateCode?: string;
  locale: string;
  candidateAssignment?: CommunicationAssignmentRef;
  initiatedBy?: CommunicationActorRef;
  recipientMasked?: string;
  providerReference?: string;
  errorCode?: string;
  sentAt?: string;
  deliveredAt?: string;
  failedAt?: string;
  createdAt: string;
}

/**
 * Server-side list filters for GET /api/v1/admin/communications
 * (Admin::Communications::IndexQuery). `candidateAssignment`/`candidate`
 * are public ids; `channel`/`status` are free text, matching the backend's
 * own free-form code columns.
 */
export interface CommunicationListFilters {
  channel?: string;
  direction?: 'inbound' | 'outbound';
  status?: string;
  candidateAssignment?: string;
  candidate?: string;
  /** ISO 8601 date (not datetime). */
  occurredFrom?: string;
  occurredTo?: string;
}

/** Matches Admin::Communications::IndexQuery::ALLOWED_SORTS, `-` prefix for descending. Defaults to `-created_at` server-side when omitted. */
export type CommunicationListSort = 'created_at' | '-created_at';

export interface CommunicationListPage {
  number?: number;
  size?: number;
}

export interface CommunicationListPagination {
  page: number;
  perPage: number;
  totalCount: number;
  totalPages: number;
}

export interface CommunicationListResult {
  items: Communication[];
  pagination: CommunicationListPagination;
  appliedFilters: Record<string, string>;
}

export type CommunicationErrorCode =
  /** 400 -- an unsupported filter, sort, or malformed date/pagination parameter (a frontend contract-drift bug, not a user-facing scenario the UI should ever trigger by hand). */
  | 'BAD_REQUEST'
  | 'FORBIDDEN'
  | 'INACTIVE_ACCOUNT'
  | 'SESSION_EXPIRED'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface CommunicationError {
  code: CommunicationErrorCode;
  /** Already-localized server message, when the backend provided one. */
  message?: string;
  field?: string;
  retryAfterSeconds?: number;
}

export interface AdminCommunicationsClient {
  listCommunications(
    filters: CommunicationListFilters,
    sort: CommunicationListSort | undefined,
    page: CommunicationListPage
  ): Promise<CommunicationListResult>;
}

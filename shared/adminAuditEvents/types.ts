// Admin audit explorer types (MPS-F803), wired to the real backend
// documented in descon-be's openapi.yaml:
//   GET /api/v1/admin/audit_events
//
// Read-only by design -- there is no show, create, update, or destroy
// endpoint, matching the backend's own "audit records can never be edited
// through the API" guarantee. This client therefore only ever lists.
//
// Web-only (AGENTS.md: "administrative workflows remain web-focused").

/** A staff actor reference -- id + role only, matching every other admin serializer's convention (never a fabricated name). Absent for system-triggered events with no human actor. */
export interface AuditEventActorRef {
  id: string;
  role: string;
}

/**
 * One row in the audit trail. `metadata` is a passthrough of whatever the
 * originating *AuditRecorder wrote -- always public ids, codes and
 * non-sensitive field names server-side (see Admin::AuditEventSerializer's
 * own doc comment), never rendered as raw/untranslated prose here beyond a
 * generic key/value listing.
 */
export interface AuditEvent {
  id: number;
  actor?: AuditEventActorRef;
  actionCode: string;
  entityType: string;
  entityId: number;
  candidateId?: string;
  reasonCode?: string;
  note?: string;
  requestId?: string;
  occurredAt: string;
  metadata: Record<string, unknown>;
}

/**
 * Server-side list filters for GET /api/v1/admin/audit_events
 * (Admin::AuditEvents::IndexQuery). `actor`/`candidate` are public ids;
 * `action`/`entityType` accept a comma-separated list, matching the
 * backend's own `code_list` parsing exactly.
 */
export interface AuditEventListFilters {
  actor?: string;
  action?: string;
  entityType?: string;
  candidate?: string;
  /** ISO 8601 date (not datetime). */
  occurredFrom?: string;
  occurredTo?: string;
}

/** Matches Admin::AuditEvents::IndexQuery::ALLOWED_SORTS, `-` prefix for descending. Defaults to `-occurred_at` server-side when omitted. */
export type AuditEventListSort = 'occurred_at' | '-occurred_at';

export interface AuditEventListPage {
  number?: number;
  size?: number;
}

export interface AuditEventListPagination {
  page: number;
  perPage: number;
  totalCount: number;
  totalPages: number;
}

export interface AuditEventListResult {
  items: AuditEvent[];
  pagination: AuditEventListPagination;
  appliedFilters: Record<string, string>;
}

export type AuditEventErrorCode =
  /** 400 -- an unsupported filter, sort, or malformed date/pagination parameter (a frontend contract-drift bug, not a user-facing scenario the UI should ever trigger by hand, since every filter here is free text the backend itself validates). */
  | 'BAD_REQUEST'
  | 'FORBIDDEN'
  | 'INACTIVE_ACCOUNT'
  | 'SESSION_EXPIRED'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface AuditEventError {
  code: AuditEventErrorCode;
  /** Already-localized server message, when the backend provided one. */
  message?: string;
  field?: string;
  retryAfterSeconds?: number;
}

export interface AdminAuditEventsClient {
  listAuditEvents(filters: AuditEventListFilters, sort: AuditEventListSort | undefined, page: AuditEventListPage): Promise<AuditEventListResult>;
}

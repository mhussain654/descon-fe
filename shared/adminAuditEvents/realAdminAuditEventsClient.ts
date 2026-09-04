// Real AdminAuditEventsClient implementation (MPS-F803), calling the
// backend documented in descon-be's openapi.yaml:
//   GET /api/v1/admin/audit_events
//
// Authentication goes through StaffAuthClient.authenticatedDataRequest, not
// authenticatedRequest -- a 400 unsupported-filter or malformed-date
// response must reach the caller intact, matching
// realAdminPaymentsClient.ts's identical rationale.
import type { ApiClient, ApiError } from '../api-client';
import type { StaffAuthClient, StaffAuthError } from '../auth/staffTypes';
import { buildAuditEventListQuery } from './auditEventListQueryParams';
import type {
  AdminAuditEventsClient,
  AuditEvent,
  AuditEventActorRef,
  AuditEventError,
  AuditEventErrorCode,
  AuditEventListFilters,
  AuditEventListPage,
  AuditEventListResult,
  AuditEventListSort,
} from './types';

interface AuditEventActorResponse {
  id: string;
  role: string;
}

interface AuditEventResponse {
  id: number;
  actor: AuditEventActorResponse | null;
  action_code: string;
  entity_type: string;
  entity_id: number;
  candidate_id: string | null;
  reason_code: string | null;
  note: string | null;
  request_id: string | null;
  occurred_at: string;
  metadata: Record<string, unknown>;
}

export interface RealAdminAuditEventsClientOptions {
  apiClient: ApiClient;
  staffAuthClient: StaffAuthClient;
  /** Read fresh on every call so a language switch is reflected immediately -- the backend localizes response messages per this header (same convention as every other real staff client in this repo). */
  getLocale: () => 'en' | 'ur';
}

function toActorRef(actor: AuditEventActorResponse | null): AuditEventActorRef | undefined {
  return actor ? { id: actor.id, role: actor.role } : undefined;
}

function toAuditEvent(data: AuditEventResponse): AuditEvent {
  return {
    id: data.id,
    actor: toActorRef(data.actor),
    actionCode: data.action_code,
    entityType: data.entity_type,
    entityId: data.entity_id,
    candidateId: data.candidate_id ?? undefined,
    reasonCode: data.reason_code ?? undefined,
    note: data.note ?? undefined,
    requestId: data.request_id ?? undefined,
    occurredAt: data.occurred_at,
    metadata: data.metadata ?? {},
  };
}

function toPagination(raw: unknown): AuditEventListResult['pagination'] {
  const value = (raw && typeof raw === 'object' ? raw : {}) as {
    page?: number;
    per_page?: number;
    total_count?: number;
    total_pages?: number;
  };
  return {
    page: typeof value.page === 'number' ? value.page : 1,
    perPage: typeof value.per_page === 'number' ? value.per_page : 0,
    totalCount: typeof value.total_count === 'number' ? value.total_count : 0,
    totalPages: typeof value.total_pages === 'number' ? value.total_pages : 0,
  };
}

function toAppliedFilters(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  );
}

/** A StaffAuthError (from the 401 refresh-and-retry path) has no `status`; anything else here is the raw ApiError authenticatedDataRequest rethrew unchanged. */
function isStaffAuthError(error: unknown): error is StaffAuthError {
  return !!error && typeof error === 'object' && 'code' in error && !('status' in error);
}

function toAuditEventError(error: unknown): AuditEventError {
  if (isStaffAuthError(error)) {
    if (error.code === 'SESSION_EXPIRED') return { code: 'SESSION_EXPIRED' };
    if (error.code === 'NETWORK_ERROR') return { code: 'NETWORK_ERROR' };
    if (error.code === 'OFFLINE') return { code: 'OFFLINE' };
    return { code: 'UNKNOWN' };
  }

  const apiError = error as ApiError;
  if (!apiError || typeof apiError !== 'object' || !('code' in apiError)) {
    return { code: 'UNKNOWN' };
  }

  if (apiError.code === 'OFFLINE') return { code: 'OFFLINE' };
  if (apiError.code === 'NETWORK_ERROR' || apiError.code === 'TIMEOUT') return { code: 'NETWORK_ERROR' };
  if (apiError.code === 'CANCELLED') return { code: 'UNKNOWN' };

  return toAuditEventErrorFromStatus(apiError);
}

function toAuditEventErrorFromStatus(apiError: ApiError): AuditEventError {
  if (apiError.status === 403) {
    const code: AuditEventErrorCode = apiError.serverCode === 'inactive_account' ? 'INACTIVE_ACCOUNT' : 'FORBIDDEN';
    return { code, message: apiError.message };
  }
  if (apiError.status === 400) return { code: 'BAD_REQUEST', message: apiError.message, field: apiError.field };
  if (apiError.status === 429) return { code: 'RATE_LIMITED', message: apiError.message, retryAfterSeconds: apiError.retryAfterSeconds };
  if (apiError.status >= 500) return { code: 'SERVER_ERROR' };

  return { code: 'UNKNOWN', message: apiError.message };
}

export function createAdminAuditEventsClient(options: RealAdminAuditEventsClientOptions): AdminAuditEventsClient {
  const { apiClient, staffAuthClient, getLocale } = options;

  return {
    async listAuditEvents(
      filters: AuditEventListFilters,
      sort: AuditEventListSort | undefined,
      page: AuditEventListPage
    ): Promise<AuditEventListResult> {
      const query = buildAuditEventListQuery(filters, sort, page);
      try {
        const result = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.getWithMeta<AuditEventResponse[]>(`/admin/audit_events${query}`, {
            headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() },
          })
        );
        if (!result) throw { code: 'UNKNOWN' } satisfies AuditEventError;

        const items = Array.isArray(result.data) ? result.data.map(toAuditEvent) : [];
        const meta = result.meta as { pagination?: unknown; applied_filters?: unknown } | undefined;
        return {
          items,
          pagination: toPagination(meta?.pagination),
          appliedFilters: toAppliedFilters(meta?.applied_filters),
        };
      } catch (error) {
        throw toAuditEventError(error);
      }
    },
  };
}

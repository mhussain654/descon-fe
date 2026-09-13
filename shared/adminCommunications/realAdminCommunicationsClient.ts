// Real AdminCommunicationsClient implementation (MPS-F706), calling the
// backend documented in descon-be's openapi.yaml:
//   GET /api/v1/admin/communications
//
// Authentication goes through StaffAuthClient.authenticatedDataRequest, not
// authenticatedRequest -- a 400 unsupported-filter or malformed-date
// response must reach the caller intact, matching
// realAdminAuditEventsClient.ts's identical rationale.
import type { ApiClient, ApiError } from '../api-client';
import type { StaffAuthClient, StaffAuthError } from '../auth/staffTypes';
import { buildCommunicationListQuery } from './communicationListQueryParams';
import type {
  AdminCommunicationsClient,
  Communication,
  CommunicationActorRef,
  CommunicationAssignmentRef,
  CommunicationError,
  CommunicationErrorCode,
  CommunicationListFilters,
  CommunicationListPage,
  CommunicationListResult,
  CommunicationListSort,
} from './types';

interface CommunicationActorResponse {
  id: string;
  role: string;
}

interface CommunicationAssignmentResponse {
  id: string;
  reference_number: string;
  candidate_id: string;
}

interface CommunicationResponse {
  id: string;
  channel_code: string;
  direction_code: 'inbound' | 'outbound';
  status_code: string;
  template_code: string | null;
  locale: string;
  candidate_assignment: CommunicationAssignmentResponse | null;
  initiated_by: CommunicationActorResponse | null;
  recipient_masked: string | null;
  provider_reference: string | null;
  error_code: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  failed_at: string | null;
  created_at: string;
}

export interface RealAdminCommunicationsClientOptions {
  apiClient: ApiClient;
  staffAuthClient: StaffAuthClient;
  /** Read fresh on every call so a language switch is reflected immediately -- the backend localizes response messages per this header (same convention as every other real staff client in this repo). */
  getLocale: () => 'en' | 'ur';
}

function toActorRef(actor: CommunicationActorResponse | null): CommunicationActorRef | undefined {
  return actor ? { id: actor.id, role: actor.role } : undefined;
}

function toAssignmentRef(assignment: CommunicationAssignmentResponse | null): CommunicationAssignmentRef | undefined {
  return assignment
    ? { id: assignment.id, referenceNumber: assignment.reference_number, candidateId: assignment.candidate_id }
    : undefined;
}

function toCommunication(data: CommunicationResponse): Communication {
  return {
    id: data.id,
    channelCode: data.channel_code,
    directionCode: data.direction_code,
    statusCode: data.status_code,
    templateCode: data.template_code ?? undefined,
    locale: data.locale,
    candidateAssignment: toAssignmentRef(data.candidate_assignment),
    initiatedBy: toActorRef(data.initiated_by),
    recipientMasked: data.recipient_masked ?? undefined,
    providerReference: data.provider_reference ?? undefined,
    errorCode: data.error_code ?? undefined,
    sentAt: data.sent_at ?? undefined,
    deliveredAt: data.delivered_at ?? undefined,
    failedAt: data.failed_at ?? undefined,
    createdAt: data.created_at,
  };
}

function toPagination(raw: unknown): CommunicationListResult['pagination'] {
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

function toCommunicationError(error: unknown): CommunicationError {
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

  return toCommunicationErrorFromStatus(apiError);
}

function toCommunicationErrorFromStatus(apiError: ApiError): CommunicationError {
  if (apiError.status === 403) {
    const code: CommunicationErrorCode = apiError.serverCode === 'inactive_account' ? 'INACTIVE_ACCOUNT' : 'FORBIDDEN';
    return { code, message: apiError.message };
  }
  if (apiError.status === 400) return { code: 'BAD_REQUEST', message: apiError.message, field: apiError.field };
  if (apiError.status === 429) return { code: 'RATE_LIMITED', message: apiError.message, retryAfterSeconds: apiError.retryAfterSeconds };
  if (apiError.status >= 500) return { code: 'SERVER_ERROR' };

  return { code: 'UNKNOWN', message: apiError.message };
}

export function createAdminCommunicationsClient(options: RealAdminCommunicationsClientOptions): AdminCommunicationsClient {
  const { apiClient, staffAuthClient, getLocale } = options;

  return {
    async listCommunications(
      filters: CommunicationListFilters,
      sort: CommunicationListSort | undefined,
      page: CommunicationListPage
    ): Promise<CommunicationListResult> {
      const query = buildCommunicationListQuery(filters, sort, page);
      try {
        const result = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.getWithMeta<CommunicationResponse[]>(`/admin/communications${query}`, {
            headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() },
          })
        );
        if (!result) throw { code: 'UNKNOWN' } satisfies CommunicationError;

        const items = Array.isArray(result.data) ? result.data.map(toCommunication) : [];
        const meta = result.meta as { pagination?: unknown; applied_filters?: unknown } | undefined;
        return {
          items,
          pagination: toPagination(meta?.pagination),
          appliedFilters: toAppliedFilters(meta?.applied_filters),
        };
      } catch (error) {
        throw toCommunicationError(error);
      }
    },
  };
}

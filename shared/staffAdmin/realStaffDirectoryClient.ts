// Real StaffDirectoryClient implementation (MPS-F203), calling the backend
// documented in descon-be's openapi.yaml:
//   GET   /api/v1/users
//   POST  /api/v1/users
//   PATCH /api/v1/users/{id}
//
// Authentication goes through StaffAuthClient.authenticatedDataRequest, not
// authenticatedRequest -- this domain's own error shapes (a 422
// validation_failed with a field for duplicate email/last-admin/
// self-suspension, a 404 for an unknown staff member) must reach the caller
// intact, matching realAdminPaymentsClient.ts's identical rationale.
import type { ApiClient, ApiError } from '../api-client';
import type { StaffAuthClient } from '../auth/staffTypes';
import type { StaffRole, StaffStatus } from '../auth/staffTypes';
import type { StaffDirectoryClient, StaffDirectoryListParams, StaffInviteInput, StaffMember } from './types';

interface StaffMemberResponse {
  id: string;
  email: string;
  role: string;
  staff_state: string;
  active: boolean;
  created_at: string;
}

export interface RealStaffDirectoryClientOptions {
  apiClient: ApiClient;
  staffAuthClient: StaffAuthClient;
  /** Read fresh on every call so a language switch is reflected immediately -- the backend localizes response messages per this header (same convention as every other real staff client in this repo). */
  getLocale: () => 'en' | 'ur';
}

function toStaffMember(data: StaffMemberResponse): StaffMember {
  return {
    id: data.id,
    email: data.email,
    role: data.role as StaffRole,
    status: data.staff_state as StaffStatus,
    createdAt: data.created_at,
  };
}

function buildListQuery(params: StaffDirectoryListParams): string {
  const query = new URLSearchParams();
  if (params.query) query.set('filter[email]', params.query);
  if (params.role) query.set('filter[role]', params.role);
  if (params.status) query.set('filter[staff_state]', params.status);
  // A generous page size: this is an internal staff directory, not a
  // large paginated collection like candidates/payments -- the UI has no
  // pagination controls (matching the mock it replaces), so fetch enough
  // to cover any realistic staff roster in one request rather than
  // building pagination UI this ticket doesn't call for.
  query.set('page[size]', '100');
  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
}

/** authenticatedDataRequest rethrows the raw ApiError from a failed call unchanged, or a StaffAuthError (no `status`) if the shared token refresh itself failed. */
function isStaffAuthError(error: unknown): error is { code: string } {
  return !!error && typeof error === 'object' && 'code' in error && !('status' in error);
}

function toStaffDirectoryError(error: unknown): ApiError {
  if (isStaffAuthError(error)) {
    if (error.code === 'SESSION_EXPIRED') return { status: 401, code: 'HTTP_4XX', serverCode: 'session_expired' };
    if (error.code === 'NETWORK_ERROR') return { status: 0, code: 'NETWORK_ERROR' };
    if (error.code === 'OFFLINE') return { status: 0, code: 'OFFLINE' };
    return { status: 0, code: 'UNKNOWN' };
  }
  return error as ApiError;
}

export function createStaffDirectoryClient(options: RealStaffDirectoryClientOptions): StaffDirectoryClient {
  const { apiClient, staffAuthClient, getLocale } = options;

  function authedRequest<T>(makeRequest: (token: string) => Promise<T | undefined>): Promise<T> {
    return staffAuthClient
      .authenticatedDataRequest(makeRequest)
      .then((result) => {
        if (result === undefined) throw { status: 0, code: 'UNKNOWN' } satisfies ApiError;
        return result;
      })
      .catch((error) => {
        throw toStaffDirectoryError(error);
      });
  }

  return {
    async listStaff(params: StaffDirectoryListParams = {}): Promise<StaffMember[]> {
      const data = await authedRequest((token) =>
        apiClient.get<StaffMemberResponse[]>(`/users${buildListQuery(params)}`, {
          headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() },
        })
      );
      return (data ?? []).map(toStaffMember);
    },

    async inviteStaff(input: StaffInviteInput): Promise<StaffMember> {
      const data = await authedRequest((token) =>
        apiClient.post<{ user: StaffMemberResponse; message: string }>(
          '/users',
          { user: { email: input.email, role: input.role } },
          { headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() } }
        )
      );
      return toStaffMember(data.user);
    },

    async updateStaffRole(staffId: string, role: StaffRole): Promise<StaffMember> {
      const data = await authedRequest((token) =>
        apiClient.patch<{ user: StaffMemberResponse; message: string }>(
          `/users/${encodeURIComponent(staffId)}`,
          { user: { role } },
          { headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() } }
        )
      );
      return toStaffMember(data.user);
    },

    async updateStaffStatus(staffId: string, status: StaffStatus): Promise<StaffMember> {
      const data = await authedRequest((token) =>
        apiClient.patch<{ user: StaffMemberResponse; message: string }>(
          `/users/${encodeURIComponent(staffId)}`,
          { user: { staff_state: status } },
          { headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() } }
        )
      );
      return toStaffMember(data.user);
    },
  };
}

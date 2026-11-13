// Real AdminFlightDetailSettingClient, calling the backend documented in
// descon-be's openapi.yaml:
//   GET   /api/v1/admin/flight_detail_setting
//   PATCH /api/v1/admin/flight_detail_setting
//
// Same shape as realAdminSupportSettingClient.ts: authenticatedDataRequest so
// the PATCH's own 422 reaches the caller intact; no Idempotency-Key (a plain
// settings update with no external side effect).
import type { ApiClient, ApiError } from '../api-client';
import type { StaffAuthClient, StaffAuthError } from '../auth/staffTypes';
import type {
  AdminFlightDetailSetting,
  AdminFlightDetailSettingClient,
  AdminFlightDetailSettingError,
  AdminFlightDetailSettingUpdateInput,
} from './types';

interface ActorResponse {
  id: string;
  role: string;
}

interface AdminFlightDetailSettingResponse {
  airline: string | null;
  flight_number: string | null;
  sector: string | null;
  departure_on: string | null;
  departure_time: string | null;
  updated_by: ActorResponse | null;
  updated_at: string;
}

export interface RealAdminFlightDetailSettingClientOptions {
  apiClient: ApiClient;
  staffAuthClient: StaffAuthClient;
  /** Read fresh on every call so a language switch is reflected immediately. */
  getLocale: () => 'en' | 'ur';
}

const PATH = '/admin/flight_detail_setting';

function toSetting(data: AdminFlightDetailSettingResponse): AdminFlightDetailSetting {
  return {
    airline: data.airline ?? null,
    flightNumber: data.flight_number ?? null,
    sector: data.sector ?? null,
    departureOn: data.departure_on ?? null,
    departureTime: data.departure_time ?? null,
    updatedBy: data.updated_by ? { id: data.updated_by.id, role: data.updated_by.role } : undefined,
    updatedAt: data.updated_at,
  };
}

/** A StaffAuthError (from authenticatedDataRequest's own refresh path) has no `status`. */
function isStaffAuthError(error: unknown): error is StaffAuthError {
  return !!error && typeof error === 'object' && 'code' in error && !('status' in error);
}

function toSettingError(error: unknown): AdminFlightDetailSettingError {
  if (isStaffAuthError(error)) {
    if (error.code === 'SESSION_EXPIRED' || error.code === 'NETWORK_ERROR' || error.code === 'OFFLINE') return { code: error.code };
    return { code: 'UNKNOWN' };
  }

  const apiError = error as ApiError;
  if (!apiError || typeof apiError !== 'object' || !('code' in apiError)) return { code: 'UNKNOWN' };
  if (apiError.code === 'OFFLINE') return { code: 'OFFLINE' };
  if (apiError.code === 'NETWORK_ERROR' || apiError.code === 'TIMEOUT') return { code: 'NETWORK_ERROR' };
  if (apiError.code === 'CANCELLED') return { code: 'UNKNOWN' };
  if (apiError.status === 403) {
    return { code: apiError.serverCode === 'inactive_account' ? 'INACTIVE_ACCOUNT' : 'FORBIDDEN', message: apiError.message };
  }
  if (apiError.status === 422) return { code: 'VALIDATION_FAILED', message: apiError.message, field: apiError.field };
  if (apiError.status >= 500) return { code: 'SERVER_ERROR' };
  return { code: 'UNKNOWN', message: apiError.message };
}

function blankToNull(value: string): string | null {
  return value.trim() || null;
}

export function createAdminFlightDetailSettingClient(
  options: RealAdminFlightDetailSettingClientOptions
): AdminFlightDetailSettingClient {
  const { apiClient, staffAuthClient, getLocale } = options;
  const headers = (token: string) => ({ Authorization: `Bearer ${token}`, 'X-Locale': getLocale() });

  return {
    async getFlightDetailSetting() {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.get<AdminFlightDetailSettingResponse>(PATH, { headers: headers(token) })
        );
        if (!data) throw { code: 'UNKNOWN' } satisfies AdminFlightDetailSettingError;
        return toSetting(data);
      } catch (error) {
        throw toSettingError(error);
      }
    },

    async updateFlightDetailSetting(input: AdminFlightDetailSettingUpdateInput) {
      const body = {
        flight_detail_setting: {
          airline: blankToNull(input.airline),
          flight_number: blankToNull(input.flightNumber),
          sector: blankToNull(input.sector),
          departure_on: blankToNull(input.departureOn),
          departure_time: blankToNull(input.departureTime),
        },
      };
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.patch<AdminFlightDetailSettingResponse>(PATH, body, { headers: headers(token) })
        );
        if (!data) throw { code: 'UNKNOWN' } satisfies AdminFlightDetailSettingError;
        return toSetting(data);
      } catch (error) {
        throw toSettingError(error);
      }
    },
  };
}

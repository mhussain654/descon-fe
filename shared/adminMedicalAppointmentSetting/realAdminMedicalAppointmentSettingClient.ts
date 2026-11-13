// Real AdminMedicalAppointmentSettingClient, calling the backend documented in
// descon-be's openapi.yaml:
//   GET   /api/v1/admin/medical_appointment_setting
//   PATCH /api/v1/admin/medical_appointment_setting
//
// Same shape as realAdminSupportSettingClient.ts: authenticatedDataRequest so
// the PATCH's own 422 reaches the caller intact; no Idempotency-Key (a plain
// settings update with no external side effect).
import type { ApiClient, ApiError } from '../api-client';
import type { StaffAuthClient, StaffAuthError } from '../auth/staffTypes';
import type {
  AdminMedicalAppointmentSetting,
  AdminMedicalAppointmentSettingClient,
  AdminMedicalAppointmentSettingError,
  AdminMedicalAppointmentSettingUpdateInput,
} from './types';

interface ActorResponse {
  id: string;
  role: string;
}

interface AdminMedicalAppointmentSettingResponse {
  center_name: string | null;
  center_address: string | null;
  appointment_on: string | null;
  appointment_time: string | null;
  updated_by: ActorResponse | null;
  updated_at: string;
}

export interface RealAdminMedicalAppointmentSettingClientOptions {
  apiClient: ApiClient;
  staffAuthClient: StaffAuthClient;
  /** Read fresh on every call so a language switch is reflected immediately. */
  getLocale: () => 'en' | 'ur';
}

const PATH = '/admin/medical_appointment_setting';

function toSetting(data: AdminMedicalAppointmentSettingResponse): AdminMedicalAppointmentSetting {
  return {
    centerName: data.center_name ?? null,
    centerAddress: data.center_address ?? null,
    appointmentOn: data.appointment_on ?? null,
    appointmentTime: data.appointment_time ?? null,
    updatedBy: data.updated_by ? { id: data.updated_by.id, role: data.updated_by.role } : undefined,
    updatedAt: data.updated_at,
  };
}

/** A StaffAuthError (from authenticatedDataRequest's own refresh path) has no `status`. */
function isStaffAuthError(error: unknown): error is StaffAuthError {
  return !!error && typeof error === 'object' && 'code' in error && !('status' in error);
}

function toSettingError(error: unknown): AdminMedicalAppointmentSettingError {
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

export function createAdminMedicalAppointmentSettingClient(
  options: RealAdminMedicalAppointmentSettingClientOptions
): AdminMedicalAppointmentSettingClient {
  const { apiClient, staffAuthClient, getLocale } = options;
  const headers = (token: string) => ({ Authorization: `Bearer ${token}`, 'X-Locale': getLocale() });

  return {
    async getMedicalAppointmentSetting() {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.get<AdminMedicalAppointmentSettingResponse>(PATH, { headers: headers(token) })
        );
        if (!data) throw { code: 'UNKNOWN' } satisfies AdminMedicalAppointmentSettingError;
        return toSetting(data);
      } catch (error) {
        throw toSettingError(error);
      }
    },

    async updateMedicalAppointmentSetting(input: AdminMedicalAppointmentSettingUpdateInput) {
      const body = {
        medical_appointment_setting: {
          center_name: blankToNull(input.centerName),
          center_address: blankToNull(input.centerAddress),
          appointment_on: blankToNull(input.appointmentOn),
          appointment_time: blankToNull(input.appointmentTime),
        },
      };
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.patch<AdminMedicalAppointmentSettingResponse>(PATH, body, { headers: headers(token) })
        );
        if (!data) throw { code: 'UNKNOWN' } satisfies AdminMedicalAppointmentSettingError;
        return toSetting(data);
      } catch (error) {
        throw toSettingError(error);
      }
    },
  };
}

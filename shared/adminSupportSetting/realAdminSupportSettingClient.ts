// Real AdminSupportSettingClient implementation (mirrors
// realAdminTrainingSettingClient.ts), calling the backend
// documented in descon-be's openapi.yaml:
//   GET   /api/v1/admin/support_setting
//   PATCH /api/v1/admin/support_setting
//
// Authentication goes through StaffAuthClient.authenticatedDataRequest, not
// authenticatedRequest -- the PATCH's own 422 shape must reach the caller
// intact, mirroring realAdminAiCallOperationalSettingsClient.ts's identical
// rationale. No Idempotency-Key header: a plain authorized update with no
// external side effect to dedupe.
import type { ApiClient, ApiError } from '../api-client';
import type { StaffAuthClient, StaffAuthError } from '../auth/staffTypes';
import type {
  AdminSupportSetting,
  AdminSupportSettingClient,
  AdminSupportSettingError,
  AdminSupportSettingErrorCode,
  AdminSupportSettingUpdateInput,
  SupportSettingActorRef,
} from './types';

interface SupportSettingActorResponse {
  id: string;
  role: string;
}

interface AdminSupportSettingResponse {
  phone_number: string | null;
  updated_by: SupportSettingActorResponse | null;
  updated_at: string;
}

export interface RealAdminSupportSettingClientOptions {
  apiClient: ApiClient;
  staffAuthClient: StaffAuthClient;
  /** Read fresh on every call so a language switch is reflected immediately -- the backend localizes response messages per this header (same convention as every other real staff client in this repo). */
  getLocale: () => 'en' | 'ur';
}

function toActorRef(actor: SupportSettingActorResponse | null): SupportSettingActorRef | undefined {
  return actor ? { id: actor.id, role: actor.role } : undefined;
}

function toAdminSupportSetting(data: AdminSupportSettingResponse): AdminSupportSetting {
  return { phoneNumber: data.phone_number ?? null, updatedBy: toActorRef(data.updated_by), updatedAt: data.updated_at };
}

/** A StaffAuthError (from authenticatedDataRequest's own 401 refresh-and-retry path) has no `status`; anything else here is the raw ApiError authenticatedDataRequest rethrew unchanged. */
function isStaffAuthError(error: unknown): error is StaffAuthError {
  return !!error && typeof error === 'object' && 'code' in error && !('status' in error);
}

function toSettingError(error: unknown): AdminSupportSettingError {
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

  return toSettingErrorFromStatus(apiError);
}

function toSettingErrorFromStatus(apiError: ApiError): AdminSupportSettingError {
  if (apiError.status === 403) {
    const code: AdminSupportSettingErrorCode = apiError.serverCode === 'inactive_account' ? 'INACTIVE_ACCOUNT' : 'FORBIDDEN';
    return { code, message: apiError.message };
  }
  if (apiError.status === 422) return { code: 'VALIDATION_FAILED', message: apiError.message, field: apiError.field };
  if (apiError.status >= 500) return { code: 'SERVER_ERROR' };

  return { code: 'UNKNOWN', message: apiError.message };
}

export function createAdminSupportSettingClient(options: RealAdminSupportSettingClientOptions): AdminSupportSettingClient {
  const { apiClient, staffAuthClient, getLocale } = options;

  return {
    async getSupportSetting(): Promise<AdminSupportSetting> {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.get<AdminSupportSettingResponse>('/admin/support_setting', {
            headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() },
          })
        );
        if (!data) throw { code: 'UNKNOWN' } satisfies AdminSupportSettingError;
        return toAdminSupportSetting(data);
      } catch (error) {
        throw toSettingError(error);
      }
    },

    async updateSupportSetting(input: AdminSupportSettingUpdateInput): Promise<AdminSupportSetting> {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.patch<AdminSupportSettingResponse>(
            '/admin/support_setting',
            { support_setting: { phone_number: input.phoneNumber.trim() || null } },
            { headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() } }
          )
        );
        if (!data) throw { code: 'UNKNOWN' } satisfies AdminSupportSettingError;
        return toAdminSupportSetting(data);
      } catch (error) {
        throw toSettingError(error);
      }
    },
  };
}

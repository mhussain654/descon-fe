// Real AdminTrainingSettingClient implementation, calling the backend
// documented in descon-be's openapi.yaml:
//   GET   /api/v1/admin/training_setting
//   PATCH /api/v1/admin/training_setting
//
// Authentication goes through StaffAuthClient.authenticatedDataRequest, not
// authenticatedRequest -- the PATCH's own 422 shape must reach the caller
// intact, mirroring realAdminAiCallOperationalSettingsClient.ts's identical
// rationale. No Idempotency-Key header: a plain authorized update with no
// external side effect to dedupe.
import type { ApiClient, ApiError } from '../api-client';
import type { StaffAuthClient, StaffAuthError } from '../auth/staffTypes';
import type {
  AdminTrainingSetting,
  AdminTrainingSettingClient,
  AdminTrainingSettingError,
  AdminTrainingSettingErrorCode,
  AdminTrainingSettingUpdateInput,
  TrainingSettingActorRef,
} from './types';

interface TrainingSettingActorResponse {
  id: string;
  role: string;
}

interface AdminTrainingSettingResponse {
  url: string;
  updated_by: TrainingSettingActorResponse | null;
  updated_at: string;
}

export interface RealAdminTrainingSettingClientOptions {
  apiClient: ApiClient;
  staffAuthClient: StaffAuthClient;
  /** Read fresh on every call so a language switch is reflected immediately -- the backend localizes response messages per this header (same convention as every other real staff client in this repo). */
  getLocale: () => 'en' | 'ur';
}

function toActorRef(actor: TrainingSettingActorResponse | null): TrainingSettingActorRef | undefined {
  return actor ? { id: actor.id, role: actor.role } : undefined;
}

function toAdminTrainingSetting(data: AdminTrainingSettingResponse): AdminTrainingSetting {
  return { url: data.url, updatedBy: toActorRef(data.updated_by), updatedAt: data.updated_at };
}

/** A StaffAuthError (from authenticatedDataRequest's own 401 refresh-and-retry path) has no `status`; anything else here is the raw ApiError authenticatedDataRequest rethrew unchanged. */
function isStaffAuthError(error: unknown): error is StaffAuthError {
  return !!error && typeof error === 'object' && 'code' in error && !('status' in error);
}

function toSettingError(error: unknown): AdminTrainingSettingError {
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

function toSettingErrorFromStatus(apiError: ApiError): AdminTrainingSettingError {
  if (apiError.status === 403) {
    const code: AdminTrainingSettingErrorCode = apiError.serverCode === 'inactive_account' ? 'INACTIVE_ACCOUNT' : 'FORBIDDEN';
    return { code, message: apiError.message };
  }
  if (apiError.status === 422) return { code: 'VALIDATION_FAILED', message: apiError.message, field: apiError.field };
  if (apiError.status >= 500) return { code: 'SERVER_ERROR' };

  return { code: 'UNKNOWN', message: apiError.message };
}

export function createAdminTrainingSettingClient(options: RealAdminTrainingSettingClientOptions): AdminTrainingSettingClient {
  const { apiClient, staffAuthClient, getLocale } = options;

  return {
    async getTrainingSetting(): Promise<AdminTrainingSetting> {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.get<AdminTrainingSettingResponse>('/admin/training_setting', {
            headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() },
          })
        );
        if (!data) throw { code: 'UNKNOWN' } satisfies AdminTrainingSettingError;
        return toAdminTrainingSetting(data);
      } catch (error) {
        throw toSettingError(error);
      }
    },

    async updateTrainingSetting(input: AdminTrainingSettingUpdateInput): Promise<AdminTrainingSetting> {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.patch<AdminTrainingSettingResponse>(
            '/admin/training_setting',
            { training_setting: { url: input.url } },
            { headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() } }
          )
        );
        if (!data) throw { code: 'UNKNOWN' } satisfies AdminTrainingSettingError;
        return toAdminTrainingSetting(data);
      } catch (error) {
        throw toSettingError(error);
      }
    },
  };
}

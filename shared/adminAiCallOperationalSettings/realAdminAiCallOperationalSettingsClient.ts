// Real AdminAiCallOperationalSettingsClient implementation (MPS-F706),
// calling the backend documented in descon-be's openapi.yaml:
//   GET   /api/v1/admin/ai_call_operational_settings
//   PATCH /api/v1/admin/ai_call_operational_settings
//
// Authentication goes through StaffAuthClient.authenticatedDataRequest, not
// authenticatedRequest -- the PATCH's own 422 shape must reach the caller
// intact, mirroring realAdminWorkflowStageCallScriptsClient.ts's identical
// rationale. No Idempotency-Key header: a plain authorized update with no
// external side effect to dedupe.
import type { ApiClient, ApiError } from '../api-client';
import type { StaffAuthClient, StaffAuthError } from '../auth/staffTypes';
import type {
  AdminAiCallOperationalSettingsClient,
  AiCallOperationalSetting,
  AiCallOperationalSettingActorRef,
  AiCallOperationalSettingError,
  AiCallOperationalSettingErrorCode,
  AiCallOperationalSettingUpdateInput,
} from './types';

interface AiCallOperationalSettingActorResponse {
  id: string;
  role: string;
}

interface AiCallOperationalSettingResponse {
  outbound_trigger_cooldown_minutes: number | null;
  daily_outbound_call_limit: number | null;
  admin_trigger_rate_limit_per_hour: number | null;
  calling_hours_start: number | null;
  calling_hours_end: number | null;
  max_call_duration_minutes: number | null;
  updated_by: AiCallOperationalSettingActorResponse | null;
  updated_at: string;
}

export interface RealAdminAiCallOperationalSettingsClientOptions {
  apiClient: ApiClient;
  staffAuthClient: StaffAuthClient;
  /** Read fresh on every call so a language switch is reflected immediately -- the backend localizes response messages per this header (same convention as every other real staff client in this repo). */
  getLocale: () => 'en' | 'ur';
}

function toActorRef(actor: AiCallOperationalSettingActorResponse | null): AiCallOperationalSettingActorRef | undefined {
  return actor ? { id: actor.id, role: actor.role } : undefined;
}

function toAiCallOperationalSetting(data: AiCallOperationalSettingResponse): AiCallOperationalSetting {
  return {
    outboundTriggerCooldownMinutes: data.outbound_trigger_cooldown_minutes,
    dailyOutboundCallLimit: data.daily_outbound_call_limit,
    adminTriggerRateLimitPerHour: data.admin_trigger_rate_limit_per_hour,
    callingHoursStart: data.calling_hours_start,
    callingHoursEnd: data.calling_hours_end,
    maxCallDurationMinutes: data.max_call_duration_minutes,
    updatedBy: toActorRef(data.updated_by),
    updatedAt: data.updated_at,
  };
}

/** A StaffAuthError (from authenticatedDataRequest's own 401 refresh-and-retry path) has no `status`; anything else here is the raw ApiError authenticatedDataRequest rethrew unchanged. */
function isStaffAuthError(error: unknown): error is StaffAuthError {
  return !!error && typeof error === 'object' && 'code' in error && !('status' in error);
}

function toSettingError(error: unknown): AiCallOperationalSettingError {
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

function toSettingErrorFromStatus(apiError: ApiError): AiCallOperationalSettingError {
  if (apiError.status === 403) {
    const code: AiCallOperationalSettingErrorCode = apiError.serverCode === 'inactive_account' ? 'INACTIVE_ACCOUNT' : 'FORBIDDEN';
    return { code, message: apiError.message };
  }
  if (apiError.status === 422) return { code: 'VALIDATION_FAILED', message: apiError.message, field: apiError.field };
  if (apiError.status >= 500) return { code: 'SERVER_ERROR' };

  return { code: 'UNKNOWN', message: apiError.message };
}

export function createAdminAiCallOperationalSettingsClient(
  options: RealAdminAiCallOperationalSettingsClientOptions
): AdminAiCallOperationalSettingsClient {
  const { apiClient, staffAuthClient, getLocale } = options;

  return {
    async getAiCallOperationalSettings(): Promise<AiCallOperationalSetting> {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.get<AiCallOperationalSettingResponse>('/admin/ai_call_operational_settings', {
            headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() },
          })
        );
        if (!data) throw { code: 'UNKNOWN' } satisfies AiCallOperationalSettingError;
        return toAiCallOperationalSetting(data);
      } catch (error) {
        throw toSettingError(error);
      }
    },

    async updateAiCallOperationalSettings(input: AiCallOperationalSettingUpdateInput): Promise<AiCallOperationalSetting> {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.patch<AiCallOperationalSettingResponse>(
            '/admin/ai_call_operational_settings',
            {
              ai_call_operational_setting: {
                outbound_trigger_cooldown_minutes: input.outboundTriggerCooldownMinutes,
                daily_outbound_call_limit: input.dailyOutboundCallLimit,
                admin_trigger_rate_limit_per_hour: input.adminTriggerRateLimitPerHour,
                calling_hours_start: input.callingHoursStart,
                calling_hours_end: input.callingHoursEnd,
                max_call_duration_minutes: input.maxCallDurationMinutes,
              },
            },
            { headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() } }
          )
        );
        if (!data) throw { code: 'UNKNOWN' } satisfies AiCallOperationalSettingError;
        return toAiCallOperationalSetting(data);
      } catch (error) {
        throw toSettingError(error);
      }
    },
  };
}

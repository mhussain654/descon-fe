// Real AdminAppSettingsClient, calling the backend documented in descon-be's
// openapi.yaml:
//   GET   /api/v1/admin/app_feature_setting
//   PATCH /api/v1/admin/app_feature_setting
//
// Same request and error handling as realAdminSupportSettingClient.ts: through
// StaffAuthClient.authenticatedDataRequest so a 422 reaches the caller intact,
// and no Idempotency-Key (a plain authorized update with nothing external to
// dedupe).
import type { ApiClient, ApiError } from '../api-client';
import type { StaffAuthClient, StaffAuthError } from '../auth/staffTypes';
import {
  APP_FEATURE_SWITCHES,
  type AdminAppSettings,
  type AdminAppSettingsClient,
  type AdminAppSettingsError,
  type AdminAppSettingsErrorCode,
  type AdminAppSettingsUpdateInput,
  type AppFeatureSwitch,
} from './types';

const SWITCH_FIELDS: Record<AppFeatureSwitch, string> = {
  cardPayment: 'card_payment',
  voucherPayment: 'voucher_payment',
  progressSms: 'progress_sms',
  automaticCalls: 'automatic_calls',
  bulkCalls: 'bulk_calls',
  documentOcr: 'document_ocr',
};

type AdminAppSettingsResponse = Record<string, unknown> & {
  sms_messages: { code: string; enabled: boolean; template_ready: boolean }[];
  server_ready: Record<string, boolean>;
  updated_by: { id: string; role: string } | null;
  updated_at: string;
};

export interface RealAdminAppSettingsClientOptions {
  apiClient: ApiClient;
  staffAuthClient: StaffAuthClient;
  /** Read fresh on every call so a language switch is reflected immediately. */
  getLocale: () => 'en' | 'ur';
}

function switchMap(read: (field: string) => unknown): Record<AppFeatureSwitch, boolean> {
  return Object.fromEntries(
    APP_FEATURE_SWITCHES.map((key) => [key, read(SWITCH_FIELDS[key]) === true])
  ) as Record<AppFeatureSwitch, boolean>;
}

export function toAdminAppSettings(data: AdminAppSettingsResponse): AdminAppSettings {
  return {
    enabled: switchMap((field) => data[`${field}_enabled`]),
    serverReady: switchMap((field) => data.server_ready?.[field]),
    smsMessages: (data.sms_messages ?? []).map((message) => ({
      code: message.code,
      enabled: message.enabled === true,
      templateReady: message.template_ready === true,
    })),
    updatedBy: data.updated_by ? { id: data.updated_by.id, role: data.updated_by.role } : undefined,
    updatedAt: data.updated_at,
  };
}

function toRequestBody(input: AdminAppSettingsUpdateInput): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const key of APP_FEATURE_SWITCHES) {
    const value = input.enabled[key];
    if (value !== undefined) body[`${SWITCH_FIELDS[key]}_enabled`] = value;
  }
  if (input.disabledSmsMessages) body.disabled_sms_messages = input.disabledSmsMessages;
  return { app_feature_setting: body };
}

/** A StaffAuthError (from authenticatedDataRequest's own 401 refresh-and-retry path) has no `status`. */
function isStaffAuthError(error: unknown): error is StaffAuthError {
  return !!error && typeof error === 'object' && 'code' in error && !('status' in error);
}

function toSettingsError(error: unknown): AdminAppSettingsError {
  if (isStaffAuthError(error)) {
    if (error.code === 'SESSION_EXPIRED') return { code: 'SESSION_EXPIRED' };
    if (error.code === 'NETWORK_ERROR') return { code: 'NETWORK_ERROR' };
    if (error.code === 'OFFLINE') return { code: 'OFFLINE' };
    return { code: 'UNKNOWN' };
  }

  const apiError = error as ApiError;
  if (!apiError || typeof apiError !== 'object' || !('code' in apiError)) return { code: 'UNKNOWN' };
  if (apiError.code === 'OFFLINE') return { code: 'OFFLINE' };
  if (apiError.code === 'NETWORK_ERROR' || apiError.code === 'TIMEOUT') return { code: 'NETWORK_ERROR' };
  if (apiError.code === 'CANCELLED') return { code: 'UNKNOWN' };

  if (apiError.status === 403) {
    const code: AdminAppSettingsErrorCode = apiError.serverCode === 'inactive_account' ? 'INACTIVE_ACCOUNT' : 'FORBIDDEN';
    return { code, message: apiError.message };
  }
  if (apiError.status === 422) return { code: 'VALIDATION_FAILED', message: apiError.message, field: apiError.field };
  if (apiError.status >= 500) return { code: 'SERVER_ERROR' };
  return { code: 'UNKNOWN', message: apiError.message };
}

export function createAdminAppSettingsClient(options: RealAdminAppSettingsClientOptions): AdminAppSettingsClient {
  const { apiClient, staffAuthClient, getLocale } = options;

  return {
    async getAppSettings(): Promise<AdminAppSettings> {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.get<AdminAppSettingsResponse>('/admin/app_feature_setting', {
            headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() },
          })
        );
        if (!data) throw { code: 'UNKNOWN' } satisfies AdminAppSettingsError;
        return toAdminAppSettings(data);
      } catch (error) {
        throw toSettingsError(error);
      }
    },

    async updateAppSettings(input: AdminAppSettingsUpdateInput): Promise<AdminAppSettings> {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.patch<AdminAppSettingsResponse>('/admin/app_feature_setting', toRequestBody(input), {
            headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() },
          })
        );
        if (!data) throw { code: 'UNKNOWN' } satisfies AdminAppSettingsError;
        return toAdminAppSettings(data);
      } catch (error) {
        throw toSettingsError(error);
      }
    },
  };
}

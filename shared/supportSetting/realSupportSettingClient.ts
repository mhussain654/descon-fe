// Real SupportSettingClient implementation (mirrors realTrainingSettingClient.ts),
// calling the backend documented
// in descon-be's openapi.yaml:
//   GET /api/v1/candidate/support_setting
//
// accessToken is passed in per call (not read from a wrapped auth client),
// matching every other candidate-facing real client's identical convention
// -- mirrors realCandidateFlightDetailClient.ts's shape.
import type { ApiClient, ApiError } from '../api-client';
import type { SupportSetting, SupportSettingClient, SupportSettingError, SupportSettingErrorCode } from './types';

interface SupportSettingResponse {
  phone_number: string | null;
}

export interface RealSupportSettingClientOptions {
  apiClient: ApiClient;
  /** Read fresh on every call so a language switch is reflected immediately -- the backend localizes response messages per this header. */
  getLocale: () => 'en' | 'ur';
}

function toSupportSetting(data: SupportSettingResponse): SupportSetting {
  return { phoneNumber: data.phone_number ?? null };
}

function toSupportSettingError(error: unknown): SupportSettingError {
  const apiError = error as ApiError;
  if (!apiError || typeof apiError !== 'object' || !('code' in apiError)) {
    return { code: 'UNKNOWN' };
  }

  if (apiError.code === 'OFFLINE') return { code: 'OFFLINE' };
  if (apiError.code === 'NETWORK_ERROR' || apiError.code === 'TIMEOUT') return { code: 'NETWORK_ERROR' };
  if (apiError.code === 'CANCELLED') return { code: 'UNKNOWN' };

  if (apiError.status === 401) return { code: 'SESSION_EXPIRED' };
  if (apiError.status === 403) {
    const code: SupportSettingErrorCode = apiError.serverCode === 'inactive_account' ? 'INACTIVE_ACCOUNT' : 'FORBIDDEN';
    return { code, message: apiError.message };
  }
  if (apiError.status === 429) return { code: 'RATE_LIMITED', retryAfterSeconds: apiError.retryAfterSeconds };
  if (apiError.status >= 500) return { code: 'SERVER_ERROR' };

  return { code: 'UNKNOWN', message: apiError.message };
}

export function createSupportSettingClient(options: RealSupportSettingClientOptions): SupportSettingClient {
  const { apiClient, getLocale } = options;

  return {
    async getSupportSetting(accessToken: string): Promise<SupportSetting> {
      try {
        const data = await apiClient.get<SupportSettingResponse>('/candidate/support_setting', {
          headers: { Authorization: `Bearer ${accessToken}`, 'X-Locale': getLocale() },
        });
        if (!data) throw { code: 'UNKNOWN' } satisfies SupportSettingError;
        return toSupportSetting(data);
      } catch (error) {
        throw toSupportSettingError(error);
      }
    },
  };
}

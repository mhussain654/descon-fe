// Real TrainingSettingClient implementation, calling the backend documented
// in descon-be's openapi.yaml:
//   GET /api/v1/candidate/training_setting
//
// accessToken is passed in per call (not read from a wrapped auth client),
// matching every other candidate-facing real client's identical convention
// -- mirrors realCandidateFlightDetailClient.ts's shape.
import type { ApiClient, ApiError } from '../api-client';
import type { TrainingSetting, TrainingSettingClient, TrainingSettingError, TrainingSettingErrorCode } from './types';

interface TrainingSettingResponse {
  url: string;
}

export interface RealTrainingSettingClientOptions {
  apiClient: ApiClient;
  /** Read fresh on every call so a language switch is reflected immediately -- the backend localizes response messages per this header. */
  getLocale: () => 'en' | 'ur';
}

function toTrainingSetting(data: TrainingSettingResponse): TrainingSetting {
  return { url: data.url };
}

function toTrainingSettingError(error: unknown): TrainingSettingError {
  const apiError = error as ApiError;
  if (!apiError || typeof apiError !== 'object' || !('code' in apiError)) {
    return { code: 'UNKNOWN' };
  }

  if (apiError.code === 'OFFLINE') return { code: 'OFFLINE' };
  if (apiError.code === 'NETWORK_ERROR' || apiError.code === 'TIMEOUT') return { code: 'NETWORK_ERROR' };
  if (apiError.code === 'CANCELLED') return { code: 'UNKNOWN' };

  if (apiError.status === 401) return { code: 'SESSION_EXPIRED' };
  if (apiError.status === 403) {
    const code: TrainingSettingErrorCode = apiError.serverCode === 'inactive_account' ? 'INACTIVE_ACCOUNT' : 'FORBIDDEN';
    return { code, message: apiError.message };
  }
  if (apiError.status === 429) return { code: 'RATE_LIMITED', retryAfterSeconds: apiError.retryAfterSeconds };
  if (apiError.status >= 500) return { code: 'SERVER_ERROR' };

  return { code: 'UNKNOWN', message: apiError.message };
}

export function createTrainingSettingClient(options: RealTrainingSettingClientOptions): TrainingSettingClient {
  const { apiClient, getLocale } = options;

  return {
    async getTrainingSetting(accessToken: string): Promise<TrainingSetting> {
      try {
        const data = await apiClient.get<TrainingSettingResponse>('/candidate/training_setting', {
          headers: { Authorization: `Bearer ${accessToken}`, 'X-Locale': getLocale() },
        });
        if (!data) throw { code: 'UNKNOWN' } satisfies TrainingSettingError;
        return toTrainingSetting(data);
      } catch (error) {
        throw toTrainingSettingError(error);
      }
    },
  };
}

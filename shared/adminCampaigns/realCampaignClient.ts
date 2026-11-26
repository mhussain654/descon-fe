// Real CampaignClient (see ./types.ts for the endpoints). Requests go through
// StaffAuthClient.authenticatedDataRequest so a 422 reaches the caller with its
// field and localized message, as in realAdminSupportSettingClient.ts.
import type { ApiClient, ApiError } from '../api-client';
import type { StaffAuthClient, StaffAuthError } from '../auth/staffTypes';
import type { Campaign, CampaignClient, CampaignCreateInput, CampaignError, CampaignErrorCode } from './types';

interface CampaignResponse {
  id: string;
  code: string;
  name: string;
  kind: string;
  country: { code: string; name: string } | null;
  active: boolean;
  created_at: string;
  candidate_count?: number;
}

interface ProfileResponse {
  selected_campaign?: CampaignResponse | null;
}

export interface RealCampaignClientOptions {
  apiClient: ApiClient;
  staffAuthClient: StaffAuthClient;
  getLocale: () => 'en' | 'ur';
}

export function toCampaign(data: CampaignResponse): Campaign {
  return {
    id: data.id,
    code: data.code,
    name: data.name,
    kind: data.kind === 'test' ? 'test' : 'regular',
    country: data.country ?? null,
    active: data.active,
    createdAt: data.created_at,
    ...(typeof data.candidate_count === 'number' ? { candidateCount: data.candidate_count } : {}),
  };
}

function isStaffAuthError(error: unknown): error is StaffAuthError {
  return !!error && typeof error === 'object' && 'code' in error && !('status' in error);
}

const PASSTHROUGH: CampaignErrorCode[] = ['SESSION_EXPIRED', 'NETWORK_ERROR', 'OFFLINE'];

function toCampaignError(error: unknown): CampaignError {
  if (isStaffAuthError(error)) {
    return { code: PASSTHROUGH.includes(error.code as CampaignErrorCode) ? (error.code as CampaignErrorCode) : 'UNKNOWN' };
  }
  const apiError = error as ApiError;
  if (!apiError || typeof apiError !== 'object' || !('code' in apiError)) return { code: 'UNKNOWN' };
  if (apiError.code === 'OFFLINE') return { code: 'OFFLINE' };
  if (apiError.code === 'NETWORK_ERROR' || apiError.code === 'TIMEOUT') return { code: 'NETWORK_ERROR' };
  if (apiError.status === 403) {
    return { code: apiError.serverCode === 'inactive_account' ? 'INACTIVE_ACCOUNT' : 'FORBIDDEN', message: apiError.message };
  }
  if (apiError.status === 422) return { code: 'VALIDATION_FAILED', message: apiError.message, field: apiError.field };
  if (typeof apiError.status === 'number' && apiError.status >= 500) return { code: 'SERVER_ERROR' };
  return { code: 'UNKNOWN', message: apiError.message };
}

export function createCampaignClient(options: RealCampaignClientOptions): CampaignClient {
  const { apiClient, staffAuthClient, getLocale } = options;
  const headers = (token: string) => ({ Authorization: `Bearer ${token}`, 'X-Locale': getLocale() });

  return {
    async listCampaigns({ includeRetired = false } = {}) {
      try {
        const query = includeRetired ? '?include_retired=true' : '';
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.get<CampaignResponse[]>(`/admin/campaigns${query}`, { headers: headers(token) })
        );
        return (data ?? []).map(toCampaign);
      } catch (error) {
        throw toCampaignError(error);
      }
    },

    async createCampaign(input: CampaignCreateInput) {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.post<CampaignResponse>(
            '/admin/campaigns',
            {
              campaign: {
                name: input.name.trim(),
                country_code: input.countryCode,
                ...(input.startDate ? { start_date: input.startDate } : {}),
              },
            },
            { headers: headers(token) }
          )
        );
        if (!data) throw { code: 'UNKNOWN' } satisfies CampaignError;
        return toCampaign(data);
      } catch (error) {
        throw toCampaignError(error);
      }
    },

    async getRunningCampaign() {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.get<ProfileResponse>('/users/profile', { headers: headers(token) })
        );
        return data?.selected_campaign ? toCampaign(data.selected_campaign) : null;
      } catch (error) {
        throw toCampaignError(error);
      }
    },

    async setRunningCampaign(campaignId: string | null) {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.patch<ProfileResponse>('/users/profile', { profile: { selected_campaign_id: campaignId } }, { headers: headers(token) })
        );
        return data?.selected_campaign ? toCampaign(data.selected_campaign) : null;
      } catch (error) {
        throw toCampaignError(error);
      }
    },
  };
}

// Real CandidateConsentClient implementation (MPS-204), calling the backend
// documented in descon-be's openapi.yaml:
//   GET  /api/v1/candidate/consent
//   POST /api/v1/candidate/consent
//
// There is no candidate refresh/retry-on-401 mechanism yet (see
// realCandidateAuthClient.ts's file header) -- a 401 here always means the
// session must end, matching AuthContext's own expiry handling.
import type { ApiClient, ApiError } from '../api-client';
import type { ConsentStatus } from '../auth/types';
import type { CandidateConsentClient, CandidateConsentError, CandidateConsentErrorCode } from './types';

interface CandidateConsentResponse {
  current_policy_version: string;
  accepted: boolean;
  accepted_at: string | null;
}

export interface RealCandidateConsentClientOptions {
  apiClient: ApiClient;
  /** Read fresh on every call so a language switch is reflected immediately, same convention as realCandidateAuthClient.ts. */
  getLocale: () => 'en' | 'ur';
}

const SERVER_CODE_TO_ERROR: Record<string, CandidateConsentErrorCode> = {
  inactive_account: 'INACTIVE_ACCOUNT',
};

function toConsentStatus(data: CandidateConsentResponse): ConsentStatus {
  return {
    currentPolicyVersion: data.current_policy_version,
    accepted: data.accepted,
    acceptedAt: data.accepted_at,
  };
}

function toConsentError(error: unknown): CandidateConsentError {
  const apiError = error as ApiError;
  if (!apiError || typeof apiError !== 'object' || !('code' in apiError)) {
    return { code: 'UNKNOWN' };
  }

  if (apiError.code === 'OFFLINE') return { code: 'OFFLINE' };
  if (apiError.code === 'NETWORK_ERROR' || apiError.code === 'TIMEOUT') return { code: 'NETWORK_ERROR' };
  if (apiError.code === 'CANCELLED') return { code: 'UNKNOWN' };

  if (apiError.status === 401) return { code: 'SESSION_EXPIRED' };
  if (apiError.status === 403) {
    const mapped = apiError.serverCode ? SERVER_CODE_TO_ERROR[apiError.serverCode] : undefined;
    return { code: mapped ?? 'UNKNOWN' };
  }
  if (apiError.status >= 500) return { code: 'SERVER_ERROR' };

  return { code: 'UNKNOWN' };
}

export function createCandidateConsentClient(options: RealCandidateConsentClientOptions): CandidateConsentClient {
  const { apiClient, getLocale } = options;

  const headers = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}`, 'X-Locale': getLocale() });

  return {
    async fetchStatus(accessToken: string): Promise<ConsentStatus> {
      try {
        const data = await apiClient.get<CandidateConsentResponse>('/candidate/consent', {
          headers: headers(accessToken),
        });
        if (!data) throw { code: 'UNKNOWN' } satisfies CandidateConsentError;
        return toConsentStatus(data);
      } catch (error) {
        throw toConsentError(error);
      }
    },

    async accept(accessToken: string): Promise<ConsentStatus> {
      try {
        const data = await apiClient.post<CandidateConsentResponse>(
          '/candidate/consent',
          {},
          { headers: headers(accessToken) }
        );
        if (!data) throw { code: 'UNKNOWN' } satisfies CandidateConsentError;
        return toConsentStatus(data);
      } catch (error) {
        throw toConsentError(error);
      }
    },
  };
}

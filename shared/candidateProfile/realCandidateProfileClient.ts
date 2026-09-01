// Real CandidateProfileClient implementation, calling the backend documented
// in descon-be's openapi.yaml:
//   GET /api/v1/candidate/profile
//
// There is no candidate refresh/retry-on-401 mechanism yet (see
// realCandidateAuthClient.ts's file header) -- a 401 here always means the
// session must end, never a "refresh and retry" opportunity, matching
// AuthContext's own expiry handling.
import type { ApiClient, ApiError } from '../api-client';
import { toPaymentEligibility, type EligibilityResponse } from '../payments/mapEligibilityResponse';
import type { CandidateProfile, CandidateProfileClient, CandidateProfileError, CandidateProfileErrorCode } from './types';

interface CandidateProfileResponse {
  id: string;
  full_name: string;
  masked_cnic: string;
  reference_number: string | null;
  preferred_locale: 'en' | 'ur';
  candidate_status: string;
  current_workflow_stage: { code: string; name: string } | null;
  active: boolean;
  payment: EligibilityResponse;
}

export interface RealCandidateProfileClientOptions {
  apiClient: ApiClient;
  /** Read fresh on every call so a language switch is reflected immediately, same convention as realCandidateAuthClient.ts. */
  getLocale: () => 'en' | 'ur';
}

/** Maps the backend's ErrorItem.code (see openapi.yaml's /candidate/profile 403 example) to the shared error taxonomy. */
const SERVER_CODE_TO_ERROR: Record<string, CandidateProfileErrorCode> = {
  inactive_account: 'INACTIVE_ACCOUNT',
};

function toProfile(data: CandidateProfileResponse): CandidateProfile {
  return {
    id: data.id,
    fullName: data.full_name,
    maskedCnic: data.masked_cnic,
    referenceNumber: data.reference_number,
    preferredLocale: data.preferred_locale,
    candidateStatus: data.candidate_status,
    currentWorkflowStage: data.current_workflow_stage,
    active: data.active,
    payment: toPaymentEligibility(data.payment),
  };
}

function toProfileError(error: unknown): CandidateProfileError {
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
    return { code: mapped ?? 'FORBIDDEN' };
  }
  if (apiError.status === 429) {
    return { code: 'RATE_LIMITED', retryAfterSeconds: apiError.retryAfterSeconds };
  }
  if (apiError.status >= 500) return { code: 'SERVER_ERROR' };

  return { code: 'UNKNOWN' };
}

export function createCandidateProfileClient(options: RealCandidateProfileClientOptions): CandidateProfileClient {
  const { apiClient, getLocale } = options;

  return {
    async getProfile(accessToken: string): Promise<CandidateProfile> {
      try {
        const data = await apiClient.get<CandidateProfileResponse>('/candidate/profile', {
          headers: { Authorization: `Bearer ${accessToken}`, 'X-Locale': getLocale() },
        });
        if (!data) throw { code: 'UNKNOWN' } satisfies CandidateProfileError;
        return toProfile(data);
      } catch (error) {
        throw toProfileError(error);
      }
    },
  };
}

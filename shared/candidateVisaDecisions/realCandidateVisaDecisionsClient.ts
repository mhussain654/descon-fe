// Real CandidateVisaDecisionsClient implementation, calling the backend
// documented in descon-be's openapi.yaml:
//   GET  /api/v1/candidate/visa_decisions
//   POST /api/v1/candidate/visa_decisions/{visa_decision_id}/visa_copy_access
//
// accessToken is passed in per call (not read from a wrapped auth client),
// matching every other candidate-facing real client's identical convention
// -- mirrors realCandidateFlightDetailClient.ts exactly.
import type { ApiClient, ApiError } from '../api-client';
import type {
  CandidateVisaDecision,
  CandidateVisaDecisionsClient,
  CandidateVisaDecisionsError,
  CandidateVisaDecisionsErrorCode,
  VisaCopyAccess,
} from './types';

interface VisaDecisionResponse {
  id: string;
  outcome_code: 'issued' | 'rejected';
  decision_date: string;
  rejection_reason_code: string | null;
  visa_copy_attached: boolean;
  created_at: string;
}

interface VisaDecisionsCollectionResponse {
  assignment_id: string | null;
  visa_decisions: VisaDecisionResponse[];
}

interface VisaCopyAccessResponse {
  visa_decision_id: string;
  url: string;
  expires_at: string;
}

export interface RealCandidateVisaDecisionsClientOptions {
  apiClient: ApiClient;
  /** Read fresh on every call so a language switch is reflected immediately -- the backend localizes response messages per this header. */
  getLocale: () => 'en' | 'ur';
}

function toVisaDecision(data: VisaDecisionResponse): CandidateVisaDecision {
  return {
    id: data.id,
    outcomeCode: data.outcome_code,
    decisionDate: data.decision_date,
    rejectionReasonCode: data.rejection_reason_code,
    visaCopyAttached: data.visa_copy_attached,
    createdAt: data.created_at,
  };
}

function toAccess(data: VisaCopyAccessResponse): VisaCopyAccess {
  return { visaDecisionId: data.visa_decision_id, url: data.url, expiresAt: data.expires_at };
}

/** Maps the backend's ErrorItem.code to the shared error taxonomy. */
const SERVER_CODE_TO_ERROR: Record<string, CandidateVisaDecisionsErrorCode> = {
  inactive_account: 'INACTIVE_ACCOUNT',
  not_found: 'NOT_FOUND',
  document_attachment_missing: 'VISA_COPY_NOT_ATTACHED',
};

function toVisaDecisionsError(error: unknown): CandidateVisaDecisionsError {
  const apiError = error as ApiError;
  if (!apiError || typeof apiError !== 'object' || !('code' in apiError)) {
    return { code: 'UNKNOWN' };
  }

  if (apiError.code === 'OFFLINE') return { code: 'OFFLINE' };
  if (apiError.code === 'NETWORK_ERROR' || apiError.code === 'TIMEOUT') return { code: 'NETWORK_ERROR' };
  if (apiError.code === 'CANCELLED') return { code: 'UNKNOWN' };

  if (apiError.status === 401) return { code: 'SESSION_EXPIRED' };

  const mapped = apiError.serverCode ? SERVER_CODE_TO_ERROR[apiError.serverCode] : undefined;
  if (mapped) return { code: mapped, message: apiError.message };

  if (apiError.status === 403) return { code: 'INACTIVE_ACCOUNT' };
  if (apiError.status === 404) return { code: 'NOT_FOUND', message: apiError.message };
  if (apiError.status === 429) return { code: 'RATE_LIMITED', retryAfterSeconds: apiError.retryAfterSeconds };
  if (apiError.status >= 500) return { code: 'SERVER_ERROR' };

  return { code: 'UNKNOWN', message: apiError.message };
}

export function createCandidateVisaDecisionsClient(
  options: RealCandidateVisaDecisionsClientOptions
): CandidateVisaDecisionsClient {
  const { apiClient, getLocale } = options;

  return {
    async listVisaDecisions(accessToken: string): Promise<CandidateVisaDecision[]> {
      try {
        const data = await apiClient.get<VisaDecisionsCollectionResponse>('/candidate/visa_decisions', {
          headers: { Authorization: `Bearer ${accessToken}`, 'X-Locale': getLocale() },
        });
        return (data?.visa_decisions ?? []).map(toVisaDecision);
      } catch (error) {
        throw toVisaDecisionsError(error);
      }
    },

    async requestVisaCopyAccess(accessToken: string, visaDecisionId: string): Promise<VisaCopyAccess> {
      try {
        const data = await apiClient.post<VisaCopyAccessResponse>(
          `/candidate/visa_decisions/${visaDecisionId}/visa_copy_access`,
          undefined,
          { headers: { Authorization: `Bearer ${accessToken}`, 'X-Locale': getLocale() } }
        );
        if (!data) throw { code: 'UNKNOWN' } satisfies CandidateVisaDecisionsError;
        return toAccess(data);
      } catch (error) {
        throw toVisaDecisionsError(error);
      }
    },
  };
}

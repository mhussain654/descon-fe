// Real AdminCandidateAiCallsClient implementation (MPS-F706), calling the
// backend documented in descon-be's openapi.yaml:
//   GET  /api/v1/admin/candidates/{candidate_id}/ai_calls
//   POST /api/v1/admin/candidates/{candidate_id}/ai_calls
//
// Authentication goes through StaffAuthClient.authenticatedDataRequest, not
// authenticatedRequest -- the POST's own 404/409/422/429/502/503 shapes
// must reach the caller intact, mirroring
// shared/adminWorkflow/realAdminWorkflowClient.ts's identical rationale.
import type { ApiClient, ApiError } from '../api-client';
import type { StaffAuthClient, StaffAuthError } from '../auth/staffTypes';
import type {
  AdminAiCallActorRef,
  AdminAiCallReason,
  AdminCandidateAiCall,
  AdminCandidateAiCallError,
  AdminCandidateAiCallErrorCode,
  AdminCandidateAiCallsClient,
} from './types';

interface CandidateAiCallActorResponse {
  id: string;
  role: string;
}

interface CandidateAiCallResponse {
  id: string;
  direction: AdminCandidateAiCall['direction'];
  call_reason: AdminAiCallReason;
  language_code: string;
  status: AdminCandidateAiCall['status'];
  triggered_by: CandidateAiCallActorResponse | null;
  outcome: AdminCandidateAiCall['outcome'] | null;
  outcome_reason: string | null;
  verification_status: AdminCandidateAiCall['verificationStatus'];
  summary: string | null;
  started_at: string | null;
  answered_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface RealAdminCandidateAiCallsClientOptions {
  apiClient: ApiClient;
  staffAuthClient: StaffAuthClient;
  /** Read fresh on every call so a language switch is reflected immediately -- the backend localizes response messages per this header (same convention as every other real staff client in this repo). */
  getLocale: () => 'en' | 'ur';
}

function toActorRef(actor: CandidateAiCallActorResponse | null): AdminAiCallActorRef | undefined {
  return actor ? { id: actor.id, role: actor.role } : undefined;
}

function toCandidateAiCall(data: CandidateAiCallResponse): AdminCandidateAiCall {
  return {
    id: data.id,
    direction: data.direction,
    callReason: data.call_reason,
    languageCode: data.language_code,
    status: data.status,
    triggeredBy: toActorRef(data.triggered_by),
    outcome: data.outcome ?? undefined,
    outcomeReason: data.outcome_reason ?? undefined,
    verificationStatus: data.verification_status,
    summary: data.summary ?? undefined,
    startedAt: data.started_at ?? undefined,
    answeredAt: data.answered_at ?? undefined,
    completedAt: data.completed_at ?? undefined,
    createdAt: data.created_at,
  };
}

/** Maps the backend's ErrorItem.code (see openapi.yaml's ai_calls POST 422/429 examples, and the shared IdempotentRequestHandling concern's 400/409 codes) to the shared error taxonomy. */
const SERVER_CODE_TO_ERROR: Partial<Record<string, AdminCandidateAiCallErrorCode>> = {
  validation_failed: 'VALIDATION_FAILED',
  idempotency_conflict: 'IDEMPOTENCY_CONFLICT',
  missing_idempotency_key: 'MISSING_IDEMPOTENCY_KEY',
  invalid_idempotency_key: 'MISSING_IDEMPOTENCY_KEY',
  idempotency_in_progress: 'RATE_LIMITED',
  inactive_account: 'INACTIVE_ACCOUNT',
};

/** A StaffAuthError (from authenticatedDataRequest's own 401 refresh-and-retry path) has no `status`; anything else here is the raw ApiError authenticatedDataRequest rethrew unchanged. */
function isStaffAuthError(error: unknown): error is StaffAuthError {
  return !!error && typeof error === 'object' && 'code' in error && !('status' in error);
}

function toCandidateAiCallError(error: unknown): AdminCandidateAiCallError {
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

  const mapped = apiError.serverCode ? SERVER_CODE_TO_ERROR[apiError.serverCode] : undefined;
  if (mapped) return { code: mapped, message: apiError.message, field: apiError.field };

  return toCandidateAiCallErrorFromStatus(apiError);
}

function toCandidateAiCallErrorFromStatus(apiError: ApiError): AdminCandidateAiCallError {
  if (apiError.status === 403) {
    const code: AdminCandidateAiCallErrorCode = apiError.serverCode === 'inactive_account' ? 'INACTIVE_ACCOUNT' : 'FORBIDDEN';
    return { code, message: apiError.message };
  }
  if (apiError.status === 404) return { code: 'NOT_FOUND', message: apiError.message };
  if (apiError.status === 409) return { code: 'IDEMPOTENCY_CONFLICT', message: apiError.message };
  if (apiError.status === 422) return { code: 'VALIDATION_FAILED', message: apiError.message, field: apiError.field };
  if (apiError.status === 429) return { code: 'RATE_LIMITED', message: apiError.message, retryAfterSeconds: apiError.retryAfterSeconds };
  if (apiError.status === 502) return { code: 'PROVIDER_ERROR', message: apiError.message };
  if (apiError.status === 503) return { code: 'CALLING_UNAVAILABLE', message: apiError.message };
  if (apiError.status >= 500) return { code: 'SERVER_ERROR' };

  return { code: 'UNKNOWN', message: apiError.message };
}

export function createAdminCandidateAiCallsClient(options: RealAdminCandidateAiCallsClientOptions): AdminCandidateAiCallsClient {
  const { apiClient, staffAuthClient, getLocale } = options;

  return {
    async listCandidateAiCalls(candidateId: string): Promise<AdminCandidateAiCall[]> {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.get<CandidateAiCallResponse[]>(`/admin/candidates/${encodeURIComponent(candidateId)}/ai_calls`, {
            headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() },
          })
        );
        return Array.isArray(data) ? data.map(toCandidateAiCall) : [];
      } catch (error) {
        throw toCandidateAiCallError(error);
      }
    },

    async triggerCandidateAiCall(
      candidateId: string,
      callReason: AdminAiCallReason,
      idempotencyKey: string
    ): Promise<AdminCandidateAiCall> {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.post<CandidateAiCallResponse>(
            `/admin/candidates/${encodeURIComponent(candidateId)}/ai_calls`,
            { candidate_ai_call: { call_reason: callReason } },
            { headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale(), 'Idempotency-Key': idempotencyKey } }
          )
        );
        if (!data) throw { code: 'UNKNOWN' } satisfies AdminCandidateAiCallError;
        return toCandidateAiCall(data);
      } catch (error) {
        throw toCandidateAiCallError(error);
      }
    },
  };
}


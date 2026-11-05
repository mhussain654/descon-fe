// Real AdminBankDetailsClient (see ./types.ts). Authenticates through
// StaffAuthClient.authenticatedDataRequest so 404/422 shapes reach the caller.
import type { ApiClient, ApiError } from '../api-client';
import type { StaffAuthClient, StaffAuthError } from '../auth/staffTypes';
import type {
  AdminBankDetail,
  AdminBankDetailError,
  AdminBankDetailErrorCode,
  AdminBankDetailsClient,
  AdminBankProofAccess,
} from './types';

interface BankDetailResponse {
  id: string;
  status: AdminBankDetail['status'];
  account_title: string;
  account_number: string;
  bank_name: string;
  proof: { file_name: string; content_type: string; file_size: number };
  submitted_at: string;
  rejection_reason?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: { id: string; role: string } | null;
}

export interface RealAdminBankDetailsClientOptions {
  apiClient: ApiClient;
  staffAuthClient: StaffAuthClient;
  getLocale: () => 'en' | 'ur';
}

function toBankDetail(data: BankDetailResponse): AdminBankDetail {
  return {
    id: data.id,
    status: data.status,
    accountTitle: data.account_title,
    accountNumber: data.account_number,
    bankName: data.bank_name,
    proof: { fileName: data.proof.file_name, contentType: data.proof.content_type, fileSize: data.proof.file_size },
    submittedAt: data.submitted_at,
    rejectionReason: data.rejection_reason ?? undefined,
    reviewedAt: data.reviewed_at ?? undefined,
    reviewedBy: data.reviewed_by ?? undefined,
  };
}

const SERVER_CODE_TO_ERROR: Partial<Record<string, AdminBankDetailErrorCode>> = {
  validation_failed: 'VALIDATION_FAILED',
  rejection_reason_required: 'VALIDATION_FAILED',
  rejection_reason_invalid: 'VALIDATION_FAILED',
  document_already_reviewed: 'ALREADY_REVIEWED',
  candidate_bank_detail_not_found: 'NOT_FOUND',
  idempotency_conflict: 'IDEMPOTENCY_CONFLICT',
  idempotency_in_progress: 'RATE_LIMITED',
  inactive_account: 'INACTIVE_ACCOUNT',
};

function isStaffAuthError(error: unknown): error is StaffAuthError {
  return !!error && typeof error === 'object' && 'code' in error && !('status' in error);
}

export function toAdminBankDetailError(error: unknown): AdminBankDetailError {
  if (isStaffAuthError(error)) {
    if (error.code === 'SESSION_EXPIRED' || error.code === 'NETWORK_ERROR' || error.code === 'OFFLINE') return { code: error.code };
    return { code: 'UNKNOWN' };
  }
  const apiError = error as ApiError;
  if (!apiError || typeof apiError !== 'object' || !('code' in apiError)) return { code: 'UNKNOWN' };
  if (apiError.code === 'OFFLINE') return { code: 'OFFLINE' };
  if (apiError.code === 'NETWORK_ERROR' || apiError.code === 'TIMEOUT') return { code: 'NETWORK_ERROR' };

  const mapped = apiError.serverCode ? SERVER_CODE_TO_ERROR[apiError.serverCode] : undefined;
  if (mapped) return { code: mapped, message: apiError.message, field: apiError.field };
  if (apiError.status === 403) return { code: 'FORBIDDEN', message: apiError.message };
  if (apiError.status === 404) return { code: 'NOT_FOUND', message: apiError.message };
  if (apiError.status === 409) return { code: 'IDEMPOTENCY_CONFLICT', message: apiError.message };
  if (apiError.status === 422) return { code: 'VALIDATION_FAILED', message: apiError.message, field: apiError.field };
  if (apiError.status === 429) return { code: 'RATE_LIMITED', message: apiError.message };
  if (apiError.status >= 500) return { code: 'SERVER_ERROR' };
  return { code: 'UNKNOWN', message: apiError.message };
}

export function createAdminBankDetailsClient(options: RealAdminBankDetailsClientOptions): AdminBankDetailsClient {
  const { apiClient, staffAuthClient, getLocale } = options;
  const path = (candidateId: string, suffix = '') => `/admin/candidates/${encodeURIComponent(candidateId)}/bank_details${suffix}`;
  const headers = (token: string, idempotencyKey?: string) => ({
    Authorization: `Bearer ${token}`,
    'X-Locale': getLocale(),
    ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
  });

  const decide = async (candidateId: string, suffix: string, body: unknown, idempotencyKey: string) => {
    try {
      const data = await staffAuthClient.authenticatedDataRequest((token) =>
        apiClient.post<BankDetailResponse>(path(candidateId, suffix), body, { headers: headers(token, idempotencyKey) })
      );
      if (!data) throw { code: 'UNKNOWN' } satisfies AdminBankDetailError;
      return toBankDetail(data);
    } catch (error) {
      throw toAdminBankDetailError(error);
    }
  };

  return {
    async get(candidateId) {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.get<BankDetailResponse>(path(candidateId), { headers: headers(token) })
        );
        return data ? toBankDetail(data) : null;
      } catch (error) {
        const mapped = toAdminBankDetailError(error);
        if (mapped.code === 'NOT_FOUND') return null;
        throw mapped;
      }
    },

    async requestProofAccess(candidateId): Promise<AdminBankProofAccess> {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.post<{ url: string; expires_at: string }>(path(candidateId, '/proof_access'), {}, { headers: headers(token) })
        );
        if (!data) throw { code: 'UNKNOWN' } satisfies AdminBankDetailError;
        return { url: data.url, expiresAt: data.expires_at };
      } catch (error) {
        throw toAdminBankDetailError(error);
      }
    },

    verify: (candidateId, idempotencyKey) => decide(candidateId, '/verification', {}, idempotencyKey),
    reject: (candidateId, reason, idempotencyKey) => decide(candidateId, '/rejection', { rejection: { reason } }, idempotencyKey),
  };
}

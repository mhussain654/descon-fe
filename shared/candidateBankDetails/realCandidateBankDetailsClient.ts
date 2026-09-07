// Real CandidateBankDetailsClient implementation (MPS-406/MPS-F401),
// calling the backend documented in descon-be's openapi.yaml:
//   GET /api/v1/candidate/bank_details
//   PUT /api/v1/candidate/bank_details
//
// accessToken is passed in per call (not read from a wrapped auth client),
// matching realCandidateDocumentsClient.ts's identical convention for
// candidate-facing clients.
import type { ApiClient, ApiError } from '../api-client';
import type {
  BankDetailUpsertParams,
  CandidateBankDetail,
  CandidateBankDetailsClient,
  CandidateBankDetailsError,
  CandidateBankDetailsErrorCode,
  CandidateBankDetailState,
  CandidateBankDetailSummary,
} from './types';

interface BankDetailProofResponse {
  file_name: string;
  content_type: string;
  file_size: number;
  uploaded_at: string;
}

interface BankDetailResponse {
  id: string;
  status: string;
  account_title: string;
  account_number: string;
  bank_name: string;
  proof: BankDetailProofResponse;
  submitted_at: string;
  updated_at: string;
}

interface BankDetailSummaryResponse {
  status: string;
  bank_detail: BankDetailResponse | null;
}

export interface RealCandidateBankDetailsClientOptions {
  apiClient: ApiClient;
  /** Read fresh on every call so a language switch is reflected immediately -- the backend localizes response messages per this header. */
  getLocale: () => 'en' | 'ur';
}

const KNOWN_STATES = new Set<string>(['missing', 'submitted']);

function toState(raw: string): CandidateBankDetailState {
  return (KNOWN_STATES.has(raw) ? raw : 'missing') as CandidateBankDetailState;
}

function toBankDetail(data: BankDetailResponse): CandidateBankDetail {
  return {
    id: data.id,
    status: toState(data.status),
    accountTitle: data.account_title,
    accountNumber: data.account_number,
    bankName: data.bank_name,
    proof: {
      fileName: data.proof.file_name,
      contentType: data.proof.content_type,
      fileSize: data.proof.file_size,
      uploadedAt: data.proof.uploaded_at,
    },
    submittedAt: data.submitted_at,
    updatedAt: data.updated_at,
  };
}

function toSummary(data: BankDetailSummaryResponse): CandidateBankDetailSummary {
  return {
    status: toState(data.status),
    bankDetail: data.bank_detail ? toBankDetail(data.bank_detail) : null,
  };
}

/** Maps the backend's ErrorItem.code (see openapi.yaml's /candidate/bank_details 422/409/403 examples) to the shared error taxonomy. */
const SERVER_CODE_TO_ERROR: Record<string, CandidateBankDetailsErrorCode> = {
  inactive_account: 'INACTIVE_ACCOUNT',
  idempotency_conflict: 'CONFLICT',
  no_current_assignment: 'NO_CURRENT_ASSIGNMENT',
  missing_account_title: 'MISSING_ACCOUNT_TITLE',
  missing_account_number: 'MISSING_ACCOUNT_NUMBER',
  invalid_account_number: 'INVALID_ACCOUNT_NUMBER',
  missing_bank_name: 'MISSING_BANK_NAME',
  missing_proof: 'MISSING_PROOF',
  unsupported_file_type: 'UNSUPPORTED_FILE_TYPE',
  file_too_large: 'FILE_TOO_LARGE',
  empty_file: 'EMPTY_FILE',
};

function toBankDetailsError(error: unknown): CandidateBankDetailsError {
  const apiError = error as ApiError;
  if (!apiError || typeof apiError !== 'object' || !('code' in apiError)) {
    return { code: 'UNKNOWN' };
  }

  if (apiError.code === 'OFFLINE') return { code: 'OFFLINE' };
  if (apiError.code === 'NETWORK_ERROR' || apiError.code === 'TIMEOUT') return { code: 'NETWORK_ERROR' };
  if (apiError.code === 'CANCELLED') return { code: 'UNKNOWN' };

  if (apiError.status === 401) return { code: 'SESSION_EXPIRED' };

  const mapped = apiError.serverCode ? SERVER_CODE_TO_ERROR[apiError.serverCode] : undefined;
  if (mapped) return { code: mapped, message: apiError.message, field: apiError.field };

  if (apiError.status === 403) return { code: 'INACTIVE_ACCOUNT' };
  if (apiError.status === 409) return { code: 'CONFLICT', message: apiError.message };
  if (apiError.status === 429) return { code: 'RATE_LIMITED', retryAfterSeconds: apiError.retryAfterSeconds };
  if (apiError.status >= 500) return { code: 'SERVER_ERROR' };

  return { code: 'UNKNOWN', message: apiError.message };
}

export function createCandidateBankDetailsClient(options: RealCandidateBankDetailsClientOptions): CandidateBankDetailsClient {
  const { apiClient, getLocale } = options;

  return {
    async getBankDetail(accessToken: string): Promise<CandidateBankDetailSummary> {
      try {
        const data = await apiClient.get<BankDetailSummaryResponse>('/candidate/bank_details', {
          headers: { Authorization: `Bearer ${accessToken}`, 'X-Locale': getLocale() },
        });
        if (!data) throw { code: 'UNKNOWN' } satisfies CandidateBankDetailsError;
        return toSummary(data);
      } catch (error) {
        throw toBankDetailsError(error);
      }
    },

    async submitBankDetail({ accessToken, formData, idempotencyKey }: BankDetailUpsertParams): Promise<CandidateBankDetailSummary> {
      try {
        const data = await apiClient.put<BankDetailSummaryResponse & { message?: string }>('/candidate/bank_details', formData, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Locale': getLocale(),
            ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
          },
        });
        if (!data) throw { code: 'UNKNOWN' } satisfies CandidateBankDetailsError;
        return toSummary(data);
      } catch (error) {
        throw toBankDetailsError(error);
      }
    },
  };
}

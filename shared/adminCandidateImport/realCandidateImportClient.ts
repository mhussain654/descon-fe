// Real CandidateImportClient implementation, calling the backend documented
// in descon-be's openapi.yaml:
//   POST /api/v1/admin/candidate_imports
//
// Authentication goes through StaffAuthClient.authenticatedDataRequest, not
// authenticatedRequest -- this call's own success/error shape (row-level
// results, a 409 idempotency conflict, a 422 file-level rejection) must
// reach the caller intact, which authenticatedRequest's StaffAuthError
// mapping would otherwise discard (see staffTypes.ts's doc comment on
// authenticatedDataRequest).
import type { ApiClient, ApiError } from '../api-client';
import type { StaffAuthClient, StaffAuthError } from '../auth/staffTypes';
import type {
  CandidateImportClient,
  CandidateImportError,
  CandidateImportErrorCode,
  CandidateImportResult,
  CandidateImportRowError,
} from './types';

interface CandidateImportRowErrorResponse {
  row: number;
  field: string;
  code: string;
  message: string;
}

interface CandidateImportResultResponse {
  successful_rows: number;
  failed_rows: number;
  skipped_rows: number;
  total_rows: number;
  errors: CandidateImportRowErrorResponse[];
}

export interface RealCandidateImportClientOptions {
  apiClient: ApiClient;
  staffAuthClient: StaffAuthClient;
  /** Read fresh on every call so a language switch is reflected immediately -- the backend localizes row-error `message`s per this header (same convention as MPS-206's candidate auth client). */
  getLocale: () => 'en' | 'ur';
}

function toRowError(row: CandidateImportRowErrorResponse): CandidateImportRowError {
  return { row: row.row, field: row.field, code: row.code, message: row.message };
}

function toResult(data: CandidateImportResultResponse): CandidateImportResult {
  return {
    successfulRows: data.successful_rows,
    failedRows: data.failed_rows,
    skippedRows: data.skipped_rows,
    totalRows: data.total_rows,
    errors: data.errors.map(toRowError),
  };
}

/** A StaffAuthError (from the 401 refresh-and-retry path) has no `status`; anything else here is the raw ApiError authenticatedDataRequest rethrew unchanged. */
function isStaffAuthError(error: unknown): error is StaffAuthError {
  return !!error && typeof error === 'object' && 'code' in error && !('status' in error);
}

function toImportError(error: unknown): CandidateImportError {
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

  const codeByStatus: Partial<Record<number, CandidateImportErrorCode>> = {
    403: 'FORBIDDEN',
    409: 'CONFLICT',
    422: 'INVALID_FILE',
    429: 'RATE_LIMITED',
  };
  const mapped = codeByStatus[apiError.status];
  if (mapped) {
    return { code: mapped, message: apiError.message, retryAfterSeconds: apiError.retryAfterSeconds };
  }
  if (apiError.status >= 500) {
    return { code: 'SERVER_ERROR' };
  }
  return { code: 'UNKNOWN', message: apiError.message };
}

export function createCandidateImportClient(options: RealCandidateImportClientOptions): CandidateImportClient {
  const { apiClient, staffAuthClient, getLocale } = options;

  return {
    async importCandidates(file: File, idempotencyKey?: string): Promise<CandidateImportResult> {
      const formData = new FormData();
      formData.append('candidate_import[file]', file);

      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.post<CandidateImportResultResponse>('/admin/candidate_imports', formData, {
            headers: {
              Authorization: `Bearer ${token}`,
              'X-Locale': getLocale(),
              ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
            },
          })
        );
        if (!data) throw { code: 'UNKNOWN' } satisfies CandidateImportError;
        return toResult(data);
      } catch (error) {
        throw toImportError(error);
      }
    },
  };
}

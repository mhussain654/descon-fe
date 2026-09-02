// Real CandidateImportClient implementation (MPS-F304 Phase A), calling the
// backend documented in descon-be's openapi.yaml:
//   GET  /api/v1/admin/candidate_imports/template
//   POST /api/v1/admin/candidate_imports/preflight
//   POST /api/v1/admin/candidate_imports/commit
//
// Authentication goes through StaffAuthClient.authenticatedDataRequest, not
// authenticatedRequest -- these calls' own success/error shape (row-level
// results, a 409 idempotency conflict, a 422 file- or token-level
// rejection) must reach the caller intact, which authenticatedRequest's
// StaffAuthError mapping would otherwise discard (see staffTypes.ts's doc
// comment on authenticatedDataRequest).
import type { ApiClient, ApiError } from '../api-client';
import type { StaffAuthClient, StaffAuthError } from '../auth/staffTypes';
import type {
  CandidateImportClient,
  CandidateImportCommitResult,
  CandidateImportError,
  CandidateImportErrorCode,
  CandidateImportPreflightResult,
  CandidateImportRowError,
  CandidateImportTemplate,
} from './types';

interface CandidateImportRowErrorResponse {
  row: number;
  field: string;
  code: string;
  message: string;
}

interface CandidateImportPreflightResultResponse {
  import_id: string;
  preflight_token: string;
  expires_at: string;
  accepted_rows: number;
  rejected_rows: number;
  warning_count: number;
  total_rows: number;
  errors: CandidateImportRowErrorResponse[];
}

interface CandidateImportCommitResultResponse {
  import_id: string;
  status: string;
  total_rows: number;
  successful_rows: number;
  failed_rows: number;
  skipped_rows: number;
  imported_rows: number;
  rejected_rows: number;
  warning_count: number;
  errors: CandidateImportRowErrorResponse[];
}

export interface RealCandidateImportClientOptions {
  apiClient: ApiClient;
  staffAuthClient: StaffAuthClient;
  /** Read fresh on every call so a language switch is reflected immediately -- the backend localizes row-error `message`s per this header (same convention as MPS-206's candidate auth client). */
  getLocale: () => 'en' | 'ur';
}

const DEFAULT_TEMPLATE_FILENAME = 'candidate-import-template-v1.csv';

function toRowError(row: CandidateImportRowErrorResponse): CandidateImportRowError {
  return { row: row.row, field: row.field, code: row.code, message: row.message };
}

function toPreflightResult(data: CandidateImportPreflightResultResponse): CandidateImportPreflightResult {
  return {
    importId: data.import_id,
    preflightToken: data.preflight_token,
    expiresAt: data.expires_at,
    acceptedRows: data.accepted_rows,
    rejectedRows: data.rejected_rows,
    warningCount: data.warning_count,
    totalRows: data.total_rows,
    errors: data.errors.map(toRowError),
  };
}

function toCommitResult(data: CandidateImportCommitResultResponse): CandidateImportCommitResult {
  return {
    importId: data.import_id,
    status: 'committed',
    totalRows: data.total_rows,
    successfulRows: data.successful_rows,
    failedRows: data.failed_rows,
    skippedRows: data.skipped_rows,
    importedRows: data.imported_rows,
    rejectedRows: data.rejected_rows,
    warningCount: data.warning_count,
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

  // A 403 needs its serverCode to distinguish "lacks the permission"
  // (FORBIDDEN) from "the account itself was deactivated" (INACTIVE_ACCOUNT)
  // -- the two demand different UI responses (a permission message vs.
  // ending the session), so this can't fold into the generic status map
  // below.
  if (apiError.status === 403) {
    const code: CandidateImportErrorCode = apiError.serverCode === 'inactive_account' ? 'INACTIVE_ACCOUNT' : 'FORBIDDEN';
    return { code, message: apiError.message };
  }

  if (apiError.status === 422) {
    // Commit's own preflight-token rejection (invalid/expired/invalidated/
    // wrong-actor) always carries this exact field -- see
    // Admin::Candidates::Imports::CommitService#validate_batch!. Only
    // recoverable by re-running preflight, never by retrying the same
    // commit, so it's a distinct code from a plain file-level INVALID_FILE.
    const code: CandidateImportErrorCode = apiError.field === 'candidate_import.preflight_token' ? 'PREFLIGHT_EXPIRED' : 'INVALID_FILE';
    return { code, message: apiError.message };
  }

  const codeByStatus: Partial<Record<number, CandidateImportErrorCode>> = {
    409: 'CONFLICT',
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
    async downloadTemplate(): Promise<CandidateImportTemplate> {
      try {
        const file = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.getFile('/admin/candidate_imports/template', {
            headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() },
          })
        );
        return { content: file.content, filename: file.filename ?? DEFAULT_TEMPLATE_FILENAME };
      } catch (error) {
        throw toImportError(error);
      }
    },

    async preflightImport(file: File): Promise<CandidateImportPreflightResult> {
      const formData = new FormData();
      formData.append('candidate_import[file]', file);

      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.post<CandidateImportPreflightResultResponse>('/admin/candidate_imports/preflight', formData, {
            headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() },
          })
        );
        if (!data) throw { code: 'UNKNOWN' } satisfies CandidateImportError;
        return toPreflightResult(data);
      } catch (error) {
        throw toImportError(error);
      }
    },

    async commitImport(preflightToken: string, idempotencyKey?: string): Promise<CandidateImportCommitResult> {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.post<CandidateImportCommitResultResponse>(
            '/admin/candidate_imports/commit',
            { candidate_import: { preflight_token: preflightToken } },
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'X-Locale': getLocale(),
                ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
              },
            }
          )
        );
        if (!data) throw { code: 'UNKNOWN' } satisfies CandidateImportError;
        return toCommitResult(data);
      } catch (error) {
        throw toImportError(error);
      }
    },
  };
}

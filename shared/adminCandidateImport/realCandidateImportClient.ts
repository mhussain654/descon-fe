// Real CandidateImportClient implementation (MPS-F304), calling the backend
// documented in descon-be's openapi.yaml:
//   GET  /api/v1/admin/candidate_imports/template
//   POST /api/v1/admin/candidate_imports/preflight
//   POST /api/v1/admin/candidate_imports/commit
//   GET  /api/v1/admin/candidate_imports
//   GET  /api/v1/admin/candidate_imports/{id}
//   POST /api/v1/admin/candidate_imports/{id}/retry
//   GET  /api/v1/admin/candidate_imports/{id}/error_export
//
// Authentication goes through StaffAuthClient.authenticatedDataRequest, not
// authenticatedRequest -- these calls' own success/error shape (row-level
// results, a 409 idempotency conflict, a 422 file- or token-level
// rejection, a 404 for a batch not owned by this actor) must reach the
// caller intact, which authenticatedRequest's StaffAuthError mapping would
// otherwise discard (see staffTypes.ts's doc comment on
// authenticatedDataRequest).
import type { ApiClient, ApiError } from '../api-client';
import type { StaffAuthClient, StaffAuthError } from '../auth/staffTypes';
import { buildImportHistoryQuery } from './historyQueryParams';
import type {
  CandidateImportBatchDetail,
  CandidateImportBatchSummary,
  CandidateImportClient,
  CandidateImportCommitAccepted,
  CandidateImportError,
  CandidateImportErrorCode,
  CandidateImportHistoryFilters,
  CandidateImportHistoryPage,
  CandidateImportHistoryResult,
  CandidateImportPreflightResult,
  CandidateImportRowError,
  CandidateImportRowResult,
  CandidateImportStatus,
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

interface CandidateImportCommitAcceptedResponse {
  import_id: string;
  status: string;
  total_rows: number;
  accepted_rows: number;
  rejected_rows: number;
  skipped_rows: number;
  committed_rows: number;
  idempotency_key_present: boolean;
}

interface CandidateImportRowResultResponse {
  row_number: number;
  status: string;
  error_field?: string;
  error_code?: string;
  message?: string;
}

interface CandidateImportBatchResponse {
  id: string;
  status: string;
  source_filename: string;
  template_version: string;
  total_rows: number;
  accepted_rows: number;
  rejected_rows: number;
  skipped_rows: number;
  committed_rows: number;
  imported_rows: number;
  error_code: string | null;
  expires_at: string | null;
  processed_at: string | null;
  failed_at: string | null;
  enqueued_at: string | null;
  created_at: string;
  row_results?: CandidateImportRowResultResponse[];
}

export interface RealCandidateImportClientOptions {
  apiClient: ApiClient;
  staffAuthClient: StaffAuthClient;
  /** Read fresh on every call so a language switch is reflected immediately -- the backend localizes row-error `message`s per this header (same convention as MPS-206's candidate auth client). */
  getLocale: () => 'en' | 'ur';
}

const DEFAULT_TEMPLATE_FILENAME = 'candidate-import-template-v1.csv';
const KNOWN_STATUSES = new Set<string>(['queued', 'processing', 'completed', 'partial', 'failed', 'invalidated']);
const KNOWN_ROW_STATUSES = new Set<string>(['accepted', 'rejected', 'skipped', 'committed']);

function toStatus(raw: string): CandidateImportStatus {
  // The backend's CandidateImportBatch::STATUSES is a closed, validated
  // enum -- an unrecognized value here would mean a contract drift this
  // client doesn't yet know about, not a value to silently coerce. Falling
  // back to 'processing' keeps the UI in its "still going, please wait"
  // state rather than crashing or falsely claiming a terminal outcome.
  return (KNOWN_STATUSES.has(raw) ? raw : 'processing') as CandidateImportStatus;
}

function toRowError(row: CandidateImportRowErrorResponse): CandidateImportRowError {
  return { row: row.row, field: row.field, code: row.code, message: row.message };
}

function toRowResult(row: CandidateImportRowResultResponse): CandidateImportRowResult {
  return {
    rowNumber: row.row_number,
    status: (KNOWN_ROW_STATUSES.has(row.status) ? row.status : 'accepted') as CandidateImportRowResult['status'],
    errorField: row.error_field,
    errorCode: row.error_code,
    message: row.message,
  };
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

function toCommitAccepted(data: CandidateImportCommitAcceptedResponse): CandidateImportCommitAccepted {
  return {
    importId: data.import_id,
    status: toStatus(data.status),
    totalRows: data.total_rows,
    acceptedRows: data.accepted_rows,
    rejectedRows: data.rejected_rows,
    skippedRows: data.skipped_rows,
    committedRows: data.committed_rows,
    idempotencyKeyPresent: data.idempotency_key_present,
  };
}

function toBatchSummary(data: CandidateImportBatchResponse): CandidateImportBatchSummary {
  return {
    id: data.id,
    status: toStatus(data.status),
    sourceFilename: data.source_filename,
    templateVersion: data.template_version,
    totalRows: data.total_rows,
    acceptedRows: data.accepted_rows,
    rejectedRows: data.rejected_rows,
    skippedRows: data.skipped_rows,
    committedRows: data.committed_rows,
    importedRows: data.imported_rows,
    errorCode: data.error_code,
    expiresAt: data.expires_at,
    processedAt: data.processed_at,
    failedAt: data.failed_at,
    enqueuedAt: data.enqueued_at,
    createdAt: data.created_at,
  };
}

function toBatchDetail(data: CandidateImportBatchResponse): CandidateImportBatchDetail {
  return {
    ...toBatchSummary(data),
    rowResults: (data.row_results ?? []).map(toRowResult),
  };
}

function toPagination(raw: unknown): CandidateImportHistoryResult['pagination'] {
  const value = (raw && typeof raw === 'object' ? raw : {}) as { page?: number; per_page?: number; total_count?: number; total_pages?: number };
  return {
    page: typeof value.page === 'number' ? value.page : 1,
    perPage: typeof value.per_page === 'number' ? value.per_page : 0,
    totalCount: typeof value.total_count === 'number' ? value.total_count : 0,
    totalPages: typeof value.total_pages === 'number' ? value.total_pages : 0,
  };
}

function toAppliedFilters(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(Object.entries(raw as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
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

  if (apiError.status === 404) return { code: 'NOT_FOUND', message: apiError.message };

  if (apiError.status === 422) {
    // Commit's own preflight-token rejection and retry's own status
    // rejection both carry an exact `field` -- see CommitService's and
    // RetryService's own `validate_*!` methods. Each demands a different
    // recovery action (re-run preflight vs. refetch the batch), so both
    // need their own distinct code rather than folding into INVALID_FILE.
    if (apiError.field === 'candidate_import.preflight_token') return { code: 'PREFLIGHT_EXPIRED', message: apiError.message };
    if (apiError.field === 'candidate_import.status') return { code: 'RETRY_NOT_ALLOWED', message: apiError.message };
    return { code: 'INVALID_FILE', message: apiError.message };
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

    async commitImport(preflightToken: string, idempotencyKey?: string): Promise<CandidateImportCommitAccepted> {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.post<CandidateImportCommitAcceptedResponse>(
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
        return toCommitAccepted(data);
      } catch (error) {
        throw toImportError(error);
      }
    },

    async getImportBatch(importId: string): Promise<CandidateImportBatchDetail> {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.get<CandidateImportBatchResponse>(`/admin/candidate_imports/${encodeURIComponent(importId)}`, {
            headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() },
          })
        );
        if (!data) throw { code: 'UNKNOWN' } satisfies CandidateImportError;
        return toBatchDetail(data);
      } catch (error) {
        throw toImportError(error);
      }
    },

    async listImportHistory(
      filters: CandidateImportHistoryFilters,
      page: CandidateImportHistoryPage
    ): Promise<CandidateImportHistoryResult> {
      const query = buildImportHistoryQuery(filters, page);
      try {
        const result = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.getWithMeta<CandidateImportBatchResponse[]>(`/admin/candidate_imports${query}`, {
            headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() },
          })
        );
        if (!result) throw { code: 'UNKNOWN' } satisfies CandidateImportError;

        const items = Array.isArray(result.data) ? result.data.map(toBatchSummary) : [];
        const meta = result.meta as { pagination?: unknown; applied_filters?: unknown } | undefined;
        return {
          items,
          pagination: toPagination(meta?.pagination),
          appliedFilters: toAppliedFilters(meta?.applied_filters),
        };
      } catch (error) {
        throw toImportError(error);
      }
    },

    async retryImport(importId: string, idempotencyKey?: string): Promise<CandidateImportBatchSummary> {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.post<CandidateImportBatchResponse>(
            `/admin/candidate_imports/${encodeURIComponent(importId)}/retry`,
            undefined,
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
        return toBatchSummary(data);
      } catch (error) {
        throw toImportError(error);
      }
    },

    async downloadErrorExport(importId: string): Promise<CandidateImportTemplate> {
      try {
        const file = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.getFile(`/admin/candidate_imports/${encodeURIComponent(importId)}/error_export`, {
            headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() },
          })
        );
        return { content: file.content, filename: file.filename ?? `candidate-import-${importId}-errors.csv` };
      } catch (error) {
        throw toImportError(error);
      }
    },
  };
}

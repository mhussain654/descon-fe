// Admin candidate-import types (MPS-F304), wired to the real backend
// documented in descon-be's openapi.yaml:
//   GET  /api/v1/admin/candidate_imports/template
//   POST /api/v1/admin/candidate_imports/preflight
//   POST /api/v1/admin/candidate_imports/commit
//   GET  /api/v1/admin/candidate_imports
//   GET  /api/v1/admin/candidate_imports/{id}
//   POST /api/v1/admin/candidate_imports/{id}/retry
//   GET  /api/v1/admin/candidate_imports/{id}/error_export
//
// Phase B (MPS-308, backend PR #31, merged): commit is now asynchronous.
// `POST .../commit` returns 202 with a `queued`/`processing` batch summary,
// never a final result -- the batch detail endpoint is the sole source of
// truth for what actually happened, reached by polling
// GET /admin/candidate_imports/{id} until the batch reaches a terminal
// status. There is no "committed" status on the backend (removed from
// Phase A's guess) -- CandidateImportBatch::STATUSES is exactly
// queued/processing/completed/partial/failed/invalidated.
//
// Web-only (AGENTS.md/ticket: "Do not add admin features to the mobile
// application") -- this module is safe to reference the browser `File` type
// directly since only web feature code ever imports it.

/** Matches CandidateImportBatch::STATUSES exactly. `queued`/`processing` are non-terminal (poll -- see pollingBackoff.ts's `isTerminalImportStatus`); the other four are terminal (stop polling). */
export type CandidateImportStatus = 'queued' | 'processing' | 'completed' | 'partial' | 'failed' | 'invalidated';

/** Matches CandidateImportRowResult's own status enum. `accepted` means preflight scheduled it but it hasn't been processed yet (only seen while the batch itself is queued/processing); `committed` means it was actually persisted as a candidate. */
export type CandidateImportRowStatus = 'accepted' | 'rejected' | 'skipped' | 'committed';

export interface CandidateImportRowResult {
  rowNumber: number;
  status: CandidateImportRowStatus;
  /** Present only for rejected/skipped rows. */
  errorField?: string;
  errorCode?: string;
  /** Already-localized server message, present whenever `errorCode` is -- render directly, never re-map `errorCode` to a client-side string. */
  message?: string;
}

/** One row-level problem from the preflight preview -- distinct from CandidateImportRowResult (which additionally carries `accepted`/`committed`, states that never apply at preflight time, before anything is queued). */
export interface CandidateImportRowError {
  row: number;
  field: string;
  code: string;
  message: string;
}

/**
 * The result of validating a CSV without persisting anything --
 * openapi.yaml's CandidateImportPreflightResult. `preflightToken` is opaque
 * and short-lived (`expiresAt`); commit submits it unchanged. `acceptedRows`
 * is how many rows are actually ready to be committed -- 0 means every row
 * was rejected and there is nothing to confirm.
 */
export interface CandidateImportPreflightResult {
  importId: string;
  preflightToken: string;
  expiresAt: string;
  acceptedRows: number;
  rejectedRows: number;
  warningCount: number;
  totalRows: number;
  errors: CandidateImportRowError[];
}

/**
 * Commit's own 202 response -- submission confirmation, never a final
 * result. `status` here is always `queued` (or, on an idempotent replay of
 * an already-claimed batch, whatever its current status happens to be) --
 * the caller must poll the batch detail endpoint for what actually
 * happened, never treat this response as completion.
 */
export interface CandidateImportCommitAccepted {
  importId: string;
  status: CandidateImportStatus;
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  skippedRows: number;
  committedRows: number;
  idempotencyKeyPresent: boolean;
}

/** One row of the import history list, or the batch detail without its row results -- both come from the same backend serializer (Admin::CandidateImports::BatchSerializer), just with `rowResults` omitted for the list. */
export interface CandidateImportBatchSummary {
  id: string;
  status: CandidateImportStatus;
  sourceFilename: string;
  templateVersion: string;
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  skippedRows: number;
  committedRows: number;
  importedRows: number;
  /** Set only for a `failed` batch (an infrastructure/processing exception, not a row-content problem). */
  errorCode: string | null;
  expiresAt: string | null;
  processedAt: string | null;
  failedAt: string | null;
  enqueuedAt: string | null;
  createdAt: string;
}

/** The batch detail -- the sole source of truth for final counts and row results (ticket: "Render final counts and row results from the detail API only"). */
export interface CandidateImportBatchDetail extends CandidateImportBatchSummary {
  rowResults: CandidateImportRowResult[];
}

/**
 * Server-side list filters for GET /api/v1/admin/candidate_imports
 * (Admin::CandidateImports::IndexQuery). The list is already scoped to the
 * authenticated actor's own imports on the backend
 * (Admin::CandidateImportPolicy::Scope: `scope.where(actor: user)`), so the
 * backend's own `filter[actor_id]` is deliberately not exposed as a client
 * filter here -- it could never narrow to anyone else's imports, only
 * (pointlessly) to the caller's own id or an empty result.
 */
export interface CandidateImportHistoryFilters {
  status?: CandidateImportStatus;
  /** ISO 8601 date (not datetime) -- Admin::CandidateImports::IndexQuery parses with Date.iso8601. */
  createdFrom?: string;
  createdTo?: string;
  templateVersion?: string;
}

export interface CandidateImportHistoryPage {
  number?: number;
  size?: number;
}

export interface CandidateImportHistoryPagination {
  page: number;
  perPage: number;
  totalCount: number;
  totalPages: number;
}

export interface CandidateImportHistoryResult {
  items: CandidateImportBatchSummary[];
  pagination: CandidateImportHistoryPagination;
  appliedFilters: Record<string, string>;
}

/** The real, backend-served, permission-checked CSV template -- not client-generated (the required/optional/template-version headers are the parser's actual current contract, which the FE must never hand-maintain a stale copy of). Reused for the error-export download, which is the same "fetch text + a filename" shape. */
export interface CandidateImportTemplate {
  content: string;
  filename: string;
}

export type CandidateImportErrorCode =
  /** 422 -- file/request-level rejection only (missing file, wrong type/size, unreadable CSV, missing/unsupported headers, unsupported template_version). Never covers row content -- see the `errors` array on the preflight result, or a batch's `rowResults`. */
  | 'INVALID_FILE'
  /** 422 on commit, specifically `field: 'candidate_import.preflight_token'` -- the token is blank, unknown, belongs to a different staff member, has expired, or was invalidated. The only correct recovery is re-running preflight; a plain retry of the same commit will never succeed. */
  | 'PREFLIGHT_EXPIRED'
  /** 422 on retry, specifically `field: 'candidate_import.status'` -- the batch isn't `failed`, or has expired. Only ever returned for a batch that was `failed` a moment ago and no longer is (e.g. someone else already retried it) -- the UI should refetch the batch rather than offer the same retry again. */
  | 'RETRY_NOT_ALLOWED'
  /** 404 -- the batch doesn't exist, or isn't visible to the authenticated actor (someone else's import). */
  | 'NOT_FOUND'
  /** 403 -- authenticated staff lacks `manage_candidates`. Does not cover an inactive account -- see `INACTIVE_ACCOUNT`. */
  | 'FORBIDDEN'
  /** 403 with `serverCode === 'inactive_account'` -- the signed-in staff member's own account was deactivated after the session was issued. Distinct from `FORBIDDEN` because the correct response is ending the local session, not just showing a permission error. */
  | 'INACTIVE_ACCOUNT'
  | 'SESSION_EXPIRED'
  /** 409 -- an identical idempotent request (same Idempotency-Key) is already processing, or was reused for a different request. */
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface CandidateImportError {
  code: CandidateImportErrorCode;
  /** Already-localized server message, when the backend provided one. */
  message?: string;
  retryAfterSeconds?: number;
}

export interface CandidateImportClient {
  /** Downloads the versioned CSV template. Throws FORBIDDEN for staff lacking manage_candidates -- there is no unauthenticated template access. */
  downloadTemplate(): Promise<CandidateImportTemplate>;

  /** Validates `file` and persists a short-lived server-side preview -- never creates a candidate. Safe to call repeatedly (e.g. after fixing and re-selecting a file); each call produces an independent preflight with its own token. */
  preflightImport(file: File): Promise<CandidateImportPreflightResult>;

  /**
   * Submits a preflight's accepted rows for asynchronous processing --
   * confirmation the request was accepted, never a final result (ticket:
   * "Treat the commit 202 Accepted response as submission confirmation --
   * not final completion"). `idempotencyKey`, when supplied, is sent as the
   * `Idempotency-Key` header -- the caller generates one fresh key per
   * successful preflight (not per commit attempt) and reuses it across a
   * retry of that same preflight, so a network/server failure followed by
   * "Retry" cannot double-submit (AGENTS.md: "Prevent accidental duplicate
   * mutations"). This is a second, independent safety net on top of the
   * backend's own token-keyed idempotency (re-submitting an
   * already-claimed token safely replays the same accepted response rather
   * than re-enqueueing).
   */
  commitImport(preflightToken: string, idempotencyKey?: string): Promise<CandidateImportCommitAccepted>;

  /** The sole source of truth for a batch's current status, final counts and row results -- poll this, never infer completion from the commit response. */
  getImportBatch(importId: string): Promise<CandidateImportBatchDetail>;

  /** The candidate manager's own import history, paginated. */
  listImportHistory(filters: CandidateImportHistoryFilters, page: CandidateImportHistoryPage): Promise<CandidateImportHistoryResult>;

  /**
   * Requeues a `failed` batch for reprocessing. `idempotencyKey`, when
   * supplied, is sent as the `Idempotency-Key` header -- the caller
   * generates one fresh key per intentional retry click and reuses it
   * across a retry of that same request (ticket: "Connect failed-import
   * retry using a stable Idempotency-Key"). Concurrent retries of the same
   * batch are serialized server-side; a replayed key returns the original
   * accepted response rather than requeueing twice.
   */
  retryImport(importId: string, idempotencyKey?: string): Promise<CandidateImportBatchSummary>;

  /** Downloads a CSV of this batch's rejected/skipped rows (row number, status, field, code, localized message only -- never candidate PII). */
  downloadErrorExport(importId: string): Promise<CandidateImportTemplate>;
}

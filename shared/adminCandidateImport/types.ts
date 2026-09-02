// Admin candidate-import types (MPS-F304 Phase A), wired to the real backend
// documented in descon-be's openapi.yaml:
//   GET  /api/v1/admin/candidate_imports/template
//   POST /api/v1/admin/candidate_imports/preflight
//   POST /api/v1/admin/candidate_imports/commit
//
// A two-phase preflight -> commit flow (MPS-306/MPS-307), replacing the
// older single-step POST /api/v1/admin/candidate_imports (which validated
// and persisted in one irreversible call, with no row-level preview or
// confirmation step). That endpoint still exists on the backend but this
// build's UI no longer uses it, since the ticket requires a real preflight
// preview and an explicit confirm-before-commit step.
//
// Deliberately does NOT include anything from Phase B (MPS-308: async
// processing progress, import history list/detail, retry controls, error
// CSV download) -- that backend contract isn't merged yet, and AGENTS.md/
// the ticket both require not fabricating it ahead of time. `importId` is
// carried on every result here specifically so Phase B's history
// list/detail can key off it without this phase inventing anything else.
//
// Web-only (AGENTS.md/ticket: "Do not add admin features to the mobile
// application") -- this module is safe to reference the browser `File` type
// directly since only web feature code ever imports it.

/** One row-level problem, from either preflight or commit. `message` is already localized server-side (I18n.t against the request's X-Locale) -- render it directly, never re-map `code` to a client-side string (openapi.yaml's CandidateImportRowError). */
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
 * The result of committing a preflight's accepted rows. `status` is always
 * `'committed'` on success (CandidateImportBatch::STATUSES on the backend
 * has no partial/failed status distinct from this) -- "completed" vs.
 * "partial success" vs. "failed" are UI-level categories this build derives
 * from `importedRows`/`totalRows`, not a field the backend returns.
 * Row-level failures can appear here even for rows preflight accepted (e.g.
 * a duplicate created by someone else between preflight and commit) -- the
 * backend re-validates every row at commit time.
 */
export interface CandidateImportCommitResult {
  importId: string;
  status: 'committed';
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  skippedRows: number;
  importedRows: number;
  rejectedRows: number;
  warningCount: number;
  errors: CandidateImportRowError[];
}

/** The real, backend-served, permission-checked CSV template -- not client-generated (the required/optional/template-version headers are the parser's actual current contract, which the FE must never hand-maintain a stale copy of). */
export interface CandidateImportTemplate {
  content: string;
  filename: string;
}

export type CandidateImportErrorCode =
  /** 422 -- file/request-level rejection only (missing file, wrong type/size, unreadable CSV, missing/unsupported headers, unsupported template_version). Never covers row content -- see the `errors` array on preflight/commit results. */
  | 'INVALID_FILE'
  /** 422 on commit, specifically `field: 'candidate_import.preflight_token'` -- the token is blank, unknown, belongs to a different staff member, has expired, or was invalidated. The only correct recovery is re-running preflight; a plain retry of the same commit will never succeed. */
  | 'PREFLIGHT_EXPIRED'
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
   * Commits a preflight's accepted rows. `idempotencyKey`, when supplied, is
   * sent as the `Idempotency-Key` header -- the caller generates one fresh
   * key per successful preflight (not per commit attempt) and reuses it
   * across a retry of that same preflight, so a network/server failure
   * followed by "Retry" cannot double-import (AGENTS.md: "Prevent
   * accidental duplicate mutations"). This is a second, independent safety
   * net on top of the backend's own token-keyed idempotency (re-submitting
   * the same `preflightToken` after a successful commit safely replays the
   * same result rather than re-processing rows) -- safe even without a key.
   */
  commitImport(preflightToken: string, idempotencyKey?: string): Promise<CandidateImportCommitResult>;
}

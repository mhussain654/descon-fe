// Admin candidate-import types (frontend ticket: "Admin Candidate Import UI
// and Candidate Profile Integration"), wired to the real backend documented
// in descon-be's openapi.yaml:
//   POST /api/v1/admin/candidate_imports
//
// Web-only (AGENTS.md/ticket: "Do not add admin features to the mobile
// application") -- this module is safe to reference the browser `File` type
// directly since only web feature code ever imports it.

/** One row-level problem from the import result. `message` is already localized server-side (I18n.t against the request's X-Locale) -- render it directly, never re-map `code` to a client-side string (openapi.yaml's CandidateImportRowError). */
export interface CandidateImportRowError {
  row: number;
  field: string;
  code: string;
  message: string;
}

/** The full result of a processed import request -- returned for both `201` (at least one row created) and `200` (no new candidates, e.g. every row was invalid/duplicate) per openapi.yaml's CandidateImportResult. Row-level problems live in `errors`, never in a request-level `422`. */
export interface CandidateImportResult {
  successfulRows: number;
  failedRows: number;
  skippedRows: number;
  totalRows: number;
  errors: CandidateImportRowError[];
}

export type CandidateImportErrorCode =
  /** 422 -- request/file-level rejection only (missing file, wrong type/size, unreadable CSV, missing required headers). Never covers row content -- see CandidateImportResult. */
  | 'INVALID_FILE'
  /** 403 -- authenticated staff lacks `manage_candidates`. Does not cover an inactive account -- see `INACTIVE_ACCOUNT`. */
  | 'FORBIDDEN'
  /** 403 with `serverCode === 'inactive_account'` -- the signed-in staff member's own account was deactivated after the session was issued. Distinct from `FORBIDDEN` because the correct response is ending the local session, not just showing a permission error (a deactivated account's session/refresh token must not keep working). */
  | 'INACTIVE_ACCOUNT'
  | 'SESSION_EXPIRED'
  /** 409 -- an identical idempotent request is already processing, or the same Idempotency-Key was reused with a different file. */
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface CandidateImportError {
  code: CandidateImportErrorCode;
  /** Already-localized server message, when the backend provided one (e.g. the 422's explanation of what was wrong with the file). */
  message?: string;
  retryAfterSeconds?: number;
}

export interface CandidateImportClient {
  /**
   * `idempotencyKey`, when supplied, is sent as the `Idempotency-Key`
   * header -- the caller generates one fresh key per selected file (not
   * per attempt) and reuses it across a retry of that same file, so a
   * network/server failure followed by "Retry" cannot create duplicate
   * candidates (AGENTS.md: "Prevent accidental duplicate mutations").
   */
  importCandidates(file: File, idempotencyKey?: string): Promise<CandidateImportResult>;
}

// Maps every CandidateImportErrorCode to the shared translation key that
// explains it, same rationale/pattern as shared/auth/errorMessages.ts and
// shared/staffAdmin/errorMessages.ts. `INVALID_FILE` and `CONFLICT` prefer
// the server-provided, already-localized `message` when present (see
// CandidateImportError.message) -- these keys are the fallback for when it
// isn't.
import type { CandidateImportErrorCode } from './types';

export const CANDIDATE_IMPORT_ERROR_KEYS: Record<CandidateImportErrorCode, string> = {
  INVALID_FILE: 'adminCandidateImportInvalidFileError',
  PREFLIGHT_EXPIRED: 'adminCandidateImportPreflightExpiredError',
  FORBIDDEN: 'dsForbiddenDescription',
  INACTIVE_ACCOUNT: 'staffAuthInactiveAccountError',
  SESSION_EXPIRED: 'dsSessionExpiredDescription',
  CONFLICT: 'adminCandidateImportConflictError',
  RATE_LIMITED: 'authRateLimitedError',
  NETWORK_ERROR: 'somethingWentWrong',
  OFFLINE: 'dsOfflineDescription',
  SERVER_ERROR: 'somethingWentWrong',
  UNKNOWN: 'somethingWentWrong',
};

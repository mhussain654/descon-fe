// Maps every CandidateDocumentsErrorCode to the shared translation key that
// explains it, same rationale/pattern as shared/adminCandidateImport/errorMessages.ts.
// Most 422 codes prefer the server-provided, already-localized `message`
// when present (see CandidateDocumentsError.message) -- these keys are the
// fallback for when it isn't.
import type { CandidateDocumentsErrorCode } from './types';

export const CANDIDATE_DOCUMENTS_ERROR_KEYS: Record<CandidateDocumentsErrorCode, string> = {
  SESSION_EXPIRED: 'dsSessionExpiredDescription',
  INACTIVE_ACCOUNT: 'candidateProfileInactiveAccountDescription',
  CONFLICT: 'candidateDocumentsConflictError',
  MISSING_FILE: 'candidateDocumentsFileRequiredError',
  INVALID_REQUIREMENT: 'somethingWentWrong',
  UNSUPPORTED_FILE_TYPE: 'candidateDocumentsInvalidFileTypeError',
  FILE_TOO_LARGE: 'candidateDocumentsFileTooLargeError',
  EMPTY_FILE: 'candidateDocumentsEmptyFileError',
  REPLACEMENT_NOT_ALLOWED: 'candidateDocumentsReplacementNotAllowedError',
  RATE_LIMITED: 'authRateLimitedError',
  NETWORK_ERROR: 'somethingWentWrong',
  OFFLINE: 'dsOfflineDescription',
  SERVER_ERROR: 'somethingWentWrong',
  UNKNOWN: 'somethingWentWrong',
};

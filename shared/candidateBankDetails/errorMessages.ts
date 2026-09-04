// Maps every CandidateBankDetailsErrorCode to the shared translation key
// that explains it, same rationale/pattern as
// shared/candidateDocuments/errorMessages.ts. Most 422 codes prefer the
// server-provided, already-localized `message` when present -- these keys
// are the fallback for when it isn't. File-validation codes reuse the
// document checklist's own keys (the underlying concept -- a bad file
// upload -- is identical).
import type { CandidateBankDetailsErrorCode } from './types';

export const CANDIDATE_BANK_DETAILS_ERROR_KEYS: Record<CandidateBankDetailsErrorCode, string> = {
  NO_CURRENT_ASSIGNMENT: 'somethingWentWrong',
  MISSING_ACCOUNT_TITLE: 'candidateBankDetailsAccountTitleRequiredError',
  MISSING_ACCOUNT_NUMBER: 'candidateBankDetailsAccountNumberRequiredError',
  INVALID_ACCOUNT_NUMBER: 'candidateBankDetailsAccountNumberInvalidError',
  MISSING_BANK_NAME: 'candidateBankDetailsBankNameRequiredError',
  MISSING_PROOF: 'candidateDocumentsFileRequiredError',
  UNSUPPORTED_FILE_TYPE: 'candidateDocumentsInvalidFileTypeError',
  EMPTY_FILE: 'candidateDocumentsEmptyFileError',
  FILE_TOO_LARGE: 'candidateDocumentsFileTooLargeError',
  CONFLICT: 'candidateDocumentsConflictError',
  FORBIDDEN: 'dsForbiddenDescription',
  INACTIVE_ACCOUNT: 'candidateProfileInactiveAccountDescription',
  SESSION_EXPIRED: 'dsSessionExpiredDescription',
  RATE_LIMITED: 'authRateLimitedError',
  NETWORK_ERROR: 'somethingWentWrong',
  OFFLINE: 'dsOfflineDescription',
  SERVER_ERROR: 'somethingWentWrong',
  UNKNOWN: 'somethingWentWrong',
};

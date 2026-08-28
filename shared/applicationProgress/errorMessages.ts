// Maps every ApplicationProgressErrorCode to the shared translation key that
// explains it, same rationale/pattern as shared/candidateDocuments/errorMessages.ts.
// Most 422/409 codes prefer the server-provided, already-localized `message`
// when present (see ApplicationProgressError.message) -- these keys are the
// fallback for when it isn't.
import type { ApplicationProgressErrorCode } from './types';

export const APPLICATION_PROGRESS_ERROR_KEYS: Record<ApplicationProgressErrorCode, string> = {
  SESSION_EXPIRED: 'dsSessionExpiredDescription',
  INACTIVE_ACCOUNT: 'candidateProfileInactiveAccountDescription',
  NO_CURRENT_ASSIGNMENT: 'applicationProgressNoAssignmentError',
  NO_DOCUMENT_REQUIREMENTS: 'applicationProgressNoRequirementsError',
  DOCUMENTS_INCOMPLETE: 'applicationProgressDocumentsIncompleteError',
  DOCUMENTS_REJECTED: 'applicationProgressDocumentsRejectedError',
  SUBMISSION_NOT_ALLOWED: 'applicationProgressSubmissionNotAllowedError',
  ALREADY_SUBMITTED: 'applicationProgressAlreadySubmittedError',
  CONFLICT: 'applicationProgressConflictError',
  IN_PROGRESS: 'applicationProgressInProgressError',
  RATE_LIMITED: 'authRateLimitedError',
  NETWORK_ERROR: 'somethingWentWrong',
  OFFLINE: 'dsOfflineDescription',
  SERVER_ERROR: 'somethingWentWrong',
  UNKNOWN: 'somethingWentWrong',
};

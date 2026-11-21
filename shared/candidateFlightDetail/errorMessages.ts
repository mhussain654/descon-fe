// Maps every CandidateFlightDetailErrorCode to the shared translation key
// that explains it, same rationale/pattern as
// shared/candidateBankDetails/errorMessages.ts.
import type { CandidateFlightDetailErrorCode } from './types';

export const CANDIDATE_FLIGHT_DETAIL_ERROR_KEYS: Record<CandidateFlightDetailErrorCode, string> = {
  NOT_FOUND: 'somethingWentWrong',
  TICKET_NOT_ATTACHED: 'candidateFlightTicketNotAttachedError',
  MISSING_FILE: 'boardingPassFailed',
  EMPTY_FILE: 'boardingPassFailed',
  FILE_TOO_LARGE: 'boardingPassTooLarge',
  UNSUPPORTED_FILE_TYPE: 'profilePhotoUnsupported',
  // The backend's own message (with the opening date) is shown when present; these are the fallbacks.
  BOARDING_PASS_UPLOAD_NOT_OPEN: 'boardingPassNotOpenYet',
  BOARDING_PASS_UPLOAD_CLOSED: 'boardingPassClosedMissing',
  FORBIDDEN: 'dsForbiddenDescription',
  INACTIVE_ACCOUNT: 'candidateProfileInactiveAccountDescription',
  SESSION_EXPIRED: 'dsSessionExpiredDescription',
  RATE_LIMITED: 'authRateLimitedError',
  NETWORK_ERROR: 'networkError',
  OFFLINE: 'dsOfflineDescription',
  SERVER_ERROR: 'somethingWentWrong',
  UNKNOWN: 'somethingWentWrong',
};

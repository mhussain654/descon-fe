// Maps every CandidateFlightDetailErrorCode to the shared translation key
// that explains it, same rationale/pattern as
// shared/candidateBankDetails/errorMessages.ts.
import type { CandidateFlightDetailErrorCode } from './types';

export const CANDIDATE_FLIGHT_DETAIL_ERROR_KEYS: Record<CandidateFlightDetailErrorCode, string> = {
  NOT_FOUND: 'somethingWentWrong',
  TICKET_NOT_ATTACHED: 'candidateFlightTicketNotAttachedError',
  FORBIDDEN: 'dsForbiddenDescription',
  INACTIVE_ACCOUNT: 'candidateProfileInactiveAccountDescription',
  SESSION_EXPIRED: 'dsSessionExpiredDescription',
  RATE_LIMITED: 'authRateLimitedError',
  NETWORK_ERROR: 'somethingWentWrong',
  OFFLINE: 'dsOfflineDescription',
  SERVER_ERROR: 'somethingWentWrong',
  UNKNOWN: 'somethingWentWrong',
};

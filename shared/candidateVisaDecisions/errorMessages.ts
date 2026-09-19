// Maps every CandidateVisaDecisionsErrorCode to the shared translation key
// that explains it, mirroring shared/candidateFlightDetail/errorMessages.ts's
// identical rationale/pattern.
import type { CandidateVisaDecisionsErrorCode } from './types';

export const CANDIDATE_VISA_DECISIONS_ERROR_KEYS: Record<CandidateVisaDecisionsErrorCode, string> = {
  NOT_FOUND: 'somethingWentWrong',
  VISA_COPY_NOT_ATTACHED: 'candidateVisaCopyNotAttachedError',
  FORBIDDEN: 'dsForbiddenDescription',
  INACTIVE_ACCOUNT: 'candidateProfileInactiveAccountDescription',
  SESSION_EXPIRED: 'dsSessionExpiredDescription',
  RATE_LIMITED: 'authRateLimitedError',
  NETWORK_ERROR: 'networkError',
  OFFLINE: 'dsOfflineDescription',
  SERVER_ERROR: 'somethingWentWrong',
  UNKNOWN: 'somethingWentWrong',
};

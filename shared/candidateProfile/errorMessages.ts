// Maps every CandidateProfileErrorCode to the shared translation key that
// explains it, same rationale/pattern as shared/auth/errorMessages.ts.
import type { CandidateProfileErrorCode } from './types';

export const CANDIDATE_PROFILE_ERROR_KEYS: Record<CandidateProfileErrorCode, string> = {
  SESSION_EXPIRED: 'dsSessionExpiredDescription',
  INACTIVE_ACCOUNT: 'candidateProfileInactiveAccountDescription',
  FORBIDDEN: 'dsForbiddenDescription',
  RATE_LIMITED: 'authRateLimitedError',
  NETWORK_ERROR: 'somethingWentWrong',
  OFFLINE: 'dsOfflineDescription',
  SERVER_ERROR: 'somethingWentWrong',
  UNKNOWN: 'somethingWentWrong',
};

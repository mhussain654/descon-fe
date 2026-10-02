// Maps every DocumentAccessErrorCode to the shared translation key that
// explains it, mirroring shared/candidateVisaDecisions/errorMessages.ts's
// identical rationale/pattern. Kept separate from CANDIDATE_DOCUMENTS_ERROR_KEYS
// since DocumentAccessErrorCode is its own, smaller taxonomy (no upload-specific
// codes apply to a view/download request).
import type { DocumentAccessErrorCode } from './types';

export const DOCUMENT_ACCESS_ERROR_KEYS: Record<DocumentAccessErrorCode, string> = {
  NOT_FOUND: 'somethingWentWrong',
  DOCUMENT_ATTACHMENT_MISSING: 'candidateDocumentAccessAttachmentMissingError',
  INACTIVE_ACCOUNT: 'candidateProfileInactiveAccountDescription',
  SESSION_EXPIRED: 'dsSessionExpiredDescription',
  RATE_LIMITED: 'authRateLimitedError',
  NETWORK_ERROR: 'networkError',
  OFFLINE: 'dsOfflineDescription',
  SERVER_ERROR: 'somethingWentWrong',
  UNKNOWN: 'somethingWentWrong',
};

import type { CandidateDocumentDisplayStatus, PccComplianceDisplayStatus } from './types';

/** Maps every possible display status (including the `'unknown'` fallback) to its translation key. Never render `status` directly -- always go through this map (ticket: "Do not render raw requirement codes or raw status codes as user-facing text."). */
export const CANDIDATE_DOCUMENT_STATUS_KEYS: Record<CandidateDocumentDisplayStatus, string> = {
  missing: 'candidateDocumentsStatusMissing',
  uploaded: 'uploaded',
  pending_review: 'candidateDocumentsStatusPendingReview',
  verified: 'verified',
  rejected: 'rejected',
  unknown: 'candidateDocumentsStatusUnknown',
};

export type CandidateDocumentStatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

/** Suggested visual treatment per the ticket: missing = neutral/warning, uploaded = informational, pending_review = informational/warning, verified = success, rejected = error. An unrecognized status is treated as neutral -- safest default when its real meaning isn't known. */
export const CANDIDATE_DOCUMENT_STATUS_TONES: Record<CandidateDocumentDisplayStatus, CandidateDocumentStatusTone> = {
  missing: 'neutral',
  uploaded: 'info',
  pending_review: 'info',
  verified: 'success',
  rejected: 'danger',
  unknown: 'neutral',
};

/** Maps every PCC compliance status (including the 'unknown' fallback) to its translation key -- never render the raw value. */
export const PCC_COMPLIANCE_STATUS_KEYS: Record<PccComplianceDisplayStatus, string> = {
  current: 'candidateDocumentsPccCompliant',
  near_expiry: 'candidateDocumentsPccNearExpiry',
  expired: 'candidateDocumentsPccExpired',
  not_applicable: 'candidateDocumentsPccNotApplicable',
  unknown: 'candidateDocumentsStatusUnknown',
};

export const PCC_COMPLIANCE_STATUS_TONES: Record<PccComplianceDisplayStatus, CandidateDocumentStatusTone> = {
  current: 'success',
  near_expiry: 'warning',
  expired: 'danger',
  not_applicable: 'neutral',
  unknown: 'neutral',
};

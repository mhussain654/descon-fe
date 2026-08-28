import type { DocumentDisplayStatus, ReviewDisplayState, ReviewState } from './types';

export type StatusTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

/**
 * Translation keys for each review state a submission can be in, plus
 * 'unknown' for a future backend state this build doesn't recognize --
 * never render the raw code. Reuses the plain, already-translated
 * 'verified' vocabulary key (same word, same meaning as the per-document
 * status below) rather than duplicating it under an admin-specific name.
 */
export const REVIEW_STATE_KEYS: Record<ReviewDisplayState, string> = {
  pending_review: 'candidateDocumentsStatusPendingReview',
  partially_reviewed: 'adminReviewStatePartiallyReviewed',
  // Same wording/meaning as the candidate application-progress state of the
  // same name -- reused rather than duplicated.
  changes_required: 'applicationProgressStateChangesRequired',
  verified: 'verified',
  unknown: 'candidateDocumentsStatusUnknown',
};

/** Meaning must not depend on color alone (AGENTS.md), but a consistent tone still helps scanability -- always paired with the label above. */
export const REVIEW_STATE_TONES: Record<ReviewDisplayState, StatusTone> = {
  pending_review: 'info',
  partially_reviewed: 'warning',
  changes_required: 'danger',
  verified: 'success',
  unknown: 'neutral',
};

export const DOCUMENT_STATUS_KEYS: Record<DocumentDisplayStatus, string> = {
  uploaded: 'uploaded',
  pending_review: 'candidateDocumentsStatusPendingReview',
  verified: 'verified',
  rejected: 'rejected',
  unknown: 'candidateDocumentsStatusUnknown',
};

export const DOCUMENT_STATUS_TONES: Record<DocumentDisplayStatus, StatusTone> = {
  uploaded: 'neutral',
  pending_review: 'info',
  verified: 'success',
  rejected: 'danger',
  unknown: 'neutral',
};

/** The full set of review states a user can filter the queue by (excludes 'unknown', which is a display-only fallback, never a filterable value). */
export const FILTERABLE_REVIEW_STATES: readonly ReviewState[] = [
  'pending_review',
  'partially_reviewed',
  'changes_required',
  'verified',
];

import type { DocumentDisplayStatus, QueueStatusFilter, ReviewDisplayState, ReviewerDisplayRole, ReviewState } from './types';

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

/** Labels/tones for the 3 filter-only queue statuses that never appear as a `review.reviewState` value on a returned item -- reuses the same vocabulary as the per-document 'rejected' status and the candidate-facing PCC compliance labels rather than duplicating them. */
type QueueStatusFilterOnly = Exclude<QueueStatusFilter, ReviewState>;

export const QUEUE_STATUS_FILTER_ONLY_KEYS: Record<QueueStatusFilterOnly, string> = {
  rejected: 'rejected',
  expired_pcc: 'candidateDocumentsPccExpired',
  near_expiry_pcc: 'candidateDocumentsPccNearExpiry',
};

export const QUEUE_STATUS_FILTER_ONLY_TONES: Record<QueueStatusFilterOnly, StatusTone> = {
  rejected: 'danger',
  expired_pcc: 'danger',
  near_expiry_pcc: 'warning',
};

/** The staff compliance-summary chip row filters by every queue status, including the 3 filter-only ones the review-state badge itself never shows (ticket: "Filter chips for these states"). */
export const FILTERABLE_QUEUE_STATUSES: readonly QueueStatusFilter[] = [
  ...FILTERABLE_REVIEW_STATES,
  'rejected',
  'expired_pcc',
  'near_expiry_pcc',
];

/** Known staff role codes -> translated label key, plus 'unknown' for a future role this build doesn't recognize yet. Never render the raw role code or a personal name -- the backend has no name field for reviewers at all. */
export const ADMIN_REVIEWER_ROLE_KEYS: Record<ReviewerDisplayRole, string> = {
  admin: 'adminReviewerRoleAdmin',
  hr: 'adminReviewerRoleHr',
  mps: 'adminReviewerRoleMps',
  finance: 'adminReviewerRoleFinance',
  management: 'adminReviewerRoleManagement',
  unknown: 'adminReviewerRoleUnknown',
};

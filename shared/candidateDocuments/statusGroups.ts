// The four document statuses a candidate sees (client feedback, agreed set):
// Required, Under Review, Complete and Rejected. "Uploaded" and "pending
// review" are both still waiting on Descon, so they read as one status.

import type { CandidateBankDetailState } from '../candidateBankDetails/types';
import type { CandidateDocumentDisplayStatus } from './types';

export type DocumentStatusGroup = 'required' | 'under_review' | 'complete' | 'rejected';

export const DOCUMENT_STATUS_GROUPS: readonly DocumentStatusGroup[] = ['complete', 'under_review', 'required', 'rejected'];

export const DOCUMENT_STATUS_GROUP_KEYS = {
  required: 'candidateDocumentsStatusRequired',
  under_review: 'candidateDocumentsStatusUnderReview',
  complete: 'candidateDocumentsStatusComplete',
  rejected: 'candidateDocumentsStatusRejected',
} as const satisfies Record<DocumentStatusGroup, string>;

/** The candidate-facing status for a document; null for a status this build doesn't recognize. */
export function documentStatusGroup(status: CandidateDocumentDisplayStatus): DocumentStatusGroup | null {
  switch (status) {
    case 'missing':
      return 'required';
    case 'uploaded':
    case 'pending_review':
      return 'under_review';
    case 'verified':
      return 'complete';
    case 'rejected':
      return 'rejected';
    default:
      return null;
  }
}

/**
 * How many documents are in each status. The bank account, though submitted
 * on its own form, is one of the items the candidate must provide, so it is
 * counted too: Required until submitted, then Under Review.
 */
export function countDocumentStatusGroups(
  items: readonly { status: CandidateDocumentDisplayStatus; required: boolean }[],
  bankDetailStatus: CandidateBankDetailState | null
): Record<DocumentStatusGroup, number> {
  const counts: Record<DocumentStatusGroup, number> = { required: 0, under_review: 0, complete: 0, rejected: 0 };
  for (const item of items) {
    const group = documentStatusGroup(item.status);
    if (group === null || (group === 'required' && !item.required)) continue;
    counts[group] += 1;
  }
  if (bankDetailStatus === 'missing') counts.required += 1;
  if (bankDetailStatus === 'submitted') counts.under_review += 1;
  return counts;
}

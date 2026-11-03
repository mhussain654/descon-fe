// The five document statuses a candidate sees (client, Nov 2026): Required ->
// Uploaded -> Under Approval -> Approved or Rejected. A document is Uploaded
// once the candidate adds it, Under Approval once they submit their documents
// for review, then Approved or Rejected as Descon reviews it.

import type { CandidateBankDetailState } from '../candidateBankDetails/types';
import type { CandidateDocumentDisplayStatus } from './types';

export type DocumentStatusGroup = 'required' | 'uploaded' | 'under_approval' | 'approved' | 'rejected';

export const DOCUMENT_STATUS_GROUP_KEYS = {
  required: 'candidateDocumentsStatusRequired',
  uploaded: 'candidateDocumentsStatusUploaded',
  under_approval: 'candidateDocumentsStatusUnderApproval',
  approved: 'candidateDocumentsStatusApproved',
  rejected: 'candidateDocumentsStatusRejected',
} as const satisfies Record<DocumentStatusGroup, string>;

/** The candidate-facing status for a document; null for a status this build doesn't recognize. */
export function documentStatusGroup(status: CandidateDocumentDisplayStatus): DocumentStatusGroup | null {
  switch (status) {
    case 'missing':
      return 'required';
    case 'uploaded':
      return 'uploaded';
    case 'pending_review':
      return 'under_approval';
    case 'verified':
      return 'approved';
    case 'rejected':
      return 'rejected';
    default:
      return null;
  }
}

type ChecklistEntry = { status: CandidateDocumentDisplayStatus; required: boolean };

/** True once the candidate has submitted their documents for review: only then can one be under approval, approved or rejected. */
export function hasSubmittedForReview(items: readonly ChecklistEntry[]): boolean {
  return items.some((item) => item.status === 'pending_review' || item.status === 'verified' || item.status === 'rejected');
}

export interface DocumentSummaryTile {
  group: DocumentStatusGroup;
  count: number;
}

/**
 * The three summary cards above the documents list. Before submitting:
 * Approved, Uploaded and Required, where Required is the fixed number of
 * documents asked for and Uploaded grows as the candidate adds them. After
 * submitting: Approved, Under Approval and Rejected, which change as Descon
 * reviews. Optional documents aren't counted. The bank account, though added
 * on its own form, is one of the items the candidate must provide: it counts
 * as Uploaded once added, then Under Approval after submitting.
 */
export function documentSummaryTiles(
  items: readonly ChecklistEntry[],
  bankDetailStatus: CandidateBankDetailState | null
): DocumentSummaryTile[] {
  const required = items.filter((item) => item.required);
  const count = (group: DocumentStatusGroup) => required.filter((item) => documentStatusGroup(item.status) === group).length;
  const bankAdded = bankDetailStatus === 'submitted' ? 1 : 0;

  if (hasSubmittedForReview(items)) {
    return [
      { group: 'approved', count: count('approved') },
      { group: 'under_approval', count: count('under_approval') + bankAdded },
      { group: 'rejected', count: count('rejected') },
    ];
  }
  return [
    { group: 'approved', count: count('approved') },
    { group: 'uploaded', count: count('uploaded') + bankAdded },
    { group: 'required', count: required.length + (bankDetailStatus === null ? 0 : 1) },
  ];
}

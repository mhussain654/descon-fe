import type { CandidateDocumentChecklistItem, CandidateDocumentDisplayStatus } from './types';

export interface CandidateDocumentProgress {
  requiredTotal: number;
  requiredSubmitted: number;
  /** 0-100, rounded. 0 when there are no required documents (avoids a division by zero, and never claims completion just because nothing was required). */
  percentage: number;
  hasRequiredDocuments: boolean;
}

/** `uploaded`/`pending_review`/`verified` all count as "submitted" for progress purposes -- this is upload/submission progress, not verification completion (ticket: "Do not claim all documents are approved merely because they were uploaded"). `missing`, `rejected`, and any unrecognized status count as incomplete. */
const SUBMITTED_STATUSES = new Set<CandidateDocumentDisplayStatus>(['uploaded', 'pending_review', 'verified']);

/** Required-document upload/submission progress. Optional (`required: false`) items never affect this -- they are excluded entirely, not counted as either complete or incomplete. */
export function calculateRequiredDocumentProgress(items: CandidateDocumentChecklistItem[]): CandidateDocumentProgress {
  const requiredItems = items.filter((item) => item.required);
  const requiredTotal = requiredItems.length;
  const requiredSubmitted = requiredItems.filter((item) => SUBMITTED_STATUSES.has(item.status)).length;
  const percentage = requiredTotal === 0 ? 0 : Math.round((requiredSubmitted / requiredTotal) * 100);

  return { requiredTotal, requiredSubmitted, percentage, hasRequiredDocuments: requiredTotal > 0 };
}

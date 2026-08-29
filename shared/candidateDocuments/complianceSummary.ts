// Pure candidate-facing compliance summary (ticket: "Document compliance
// summaries"). Prefers the backend's own aggregate counts always --
// `ApplicationProgressDocuments` already provides required/missing/
// uploaded/pending/verified/rejected/submitted/completion%/canSubmit/
// blockingRequirements, computed server-side. This module only adds the
// two things that aggregate doesn't break out: PCC expired/near-expiry
// counts (derived from the checklist items' own `complianceStatus`, since
// the progress endpoint doesn't separate them) and a verification
// percentage distinct from submission completion (ticket: "Keep upload/
// submission progress separate from verification progress" -- completion%
// measures submitted/required, this measures verified/required).
import type { ApplicationProgressDocuments } from '../applicationProgress/types';
import type { CandidateDocumentChecklistItem } from './types';

export interface CandidateComplianceSummary extends ApplicationProgressDocuments {
  expired: number;
  nearExpiry: number;
  /** verified / requiredTotal, as a whole-number percentage. 0 when there are no required documents (never NaN/Infinity). */
  verificationPercentage: number;
}

export function buildComplianceSummary(
  documents: ApplicationProgressDocuments,
  checklist: CandidateDocumentChecklistItem[]
): CandidateComplianceSummary {
  const requiredItems = checklist.filter((item) => item.required);
  const expired = requiredItems.filter((item) => item.document?.complianceStatus === 'expired').length;
  const nearExpiry = requiredItems.filter((item) => item.document?.complianceStatus === 'near_expiry').length;

  const verificationPercentage =
    documents.requiredTotal === 0 ? 0 : Math.round((documents.verified * 100) / documents.requiredTotal);

  return { ...documents, expired, nearExpiry, verificationPercentage };
}

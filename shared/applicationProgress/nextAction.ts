// Pure "what should the candidate do next" priority (ticket: "Suggested
// next-action priority"), computed from already-fetched, already-mapped
// data -- never a new backend call, never a workflow transition. This is
// presentation logic only: it picks which single message to show, it does
// not perform or authorize any action itself.
import type { ApplicationProgress } from './types';
import type { CandidateDocumentChecklistItem } from '../candidateDocuments/types';

export type NextActionKind =
  | 'rejected_replaceable'
  | 'missing_required'
  | 'expired_pcc_replaceable'
  | 'ready_to_submit'
  | 'awaiting_review'
  | 'verified'
  | 'workflow_stage';

export interface NextAction {
  kind: NextActionKind;
  /** Already-localized requirement name, when the action concerns one specific document. */
  requirementName?: string;
}

/**
 * Ticket's 7-step priority, in order:
 * 1. Rejected required document that can be replaced
 * 2. Missing required document
 * 3. Expired replaceable PCC
 * 4. Documents ready to submit
 * 5. Documents awaiting review
 * 6. Verification completed
 * 7. Backend-provided workflow action (fallback)
 */
export function resolveNextAction(
  progress: ApplicationProgress,
  checklist: CandidateDocumentChecklistItem[]
): NextAction {
  const requiredItems = checklist.filter((item) => item.required);

  const rejectedReplaceable = requiredItems.find((item) => item.status === 'rejected' && item.replacementAllowed);
  if (rejectedReplaceable) return { kind: 'rejected_replaceable', requirementName: rejectedReplaceable.name };

  const missing = requiredItems.find((item) => item.status === 'missing');
  if (missing) return { kind: 'missing_required', requirementName: missing.name };

  const expiredPccReplaceable = requiredItems.find(
    (item) => item.document?.complianceStatus === 'expired' && item.replacementAllowed
  );
  if (expiredPccReplaceable) return { kind: 'expired_pcc_replaceable', requirementName: expiredPccReplaceable.name };

  const documents = progress.documents;
  if (documents.canSubmit) return { kind: 'ready_to_submit' };
  if (documents.pendingReview > 0) return { kind: 'awaiting_review' };
  if (documents.submissionState === 'verified') return { kind: 'verified' };

  return { kind: 'workflow_stage', requirementName: progress.currentWorkflowStage?.name };
}

export const NEXT_ACTION_KEYS: Record<NextActionKind, string> = {
  rejected_replaceable: 'applicationProgressNextActionRejectedReplaceable',
  missing_required: 'applicationProgressNextActionMissing',
  expired_pcc_replaceable: 'applicationProgressNextActionExpiredPcc',
  ready_to_submit: 'applicationProgressNextActionReadyToSubmit',
  awaiting_review: 'applicationProgressNextActionAwaitingReview',
  verified: 'applicationProgressNextActionVerified',
  workflow_stage: 'applicationProgressNextActionWorkflowFallback',
};

// Pure "what should the candidate do next" priority (ticket: "Suggested
// next-action priority"), computed from already-fetched, already-mapped
// data -- never a new backend call, never a workflow transition. This is
// presentation logic only: it picks which single message to show, it does
// not perform or authorize any action itself.
import type { ApplicationProgress } from './types';
import type { CandidateDocumentChecklistItem } from '../candidateDocuments/types';

export type NextActionKind =
  | 'rejected_replaceable'
  | 'no_documents_uploaded'
  | 'missing_required'
  | 'expired_pcc_replaceable'
  | 'ready_to_submit'
  | 'awaiting_review'
  | 'verified'
  | 'pay_fee'
  | 'workflow_stage';

export interface NextAction {
  kind: NextActionKind;
  /** Already-localized requirement name, when the action concerns one specific document. */
  requirementName?: string;
}

/**
 * Ticket's 7-step priority, in order (step 2 splits into two message shapes
 * depending on whether any progress has been made yet -- see below):
 * 1. Rejected required document that can be replaced
 * 2. Missing required document(s) -- generic "get started" message if none
 *    have been submitted yet, otherwise names the specific one still missing
 * 3. Expired replaceable PCC
 * 4. Documents ready to submit
 * 5. Documents awaiting review
 * 6. Verification completed
 * 7. Fee payment due -- a named action ("Pay Fee"), not the generic
 *    workflow-stage fallback, since paying is a real thing the candidate can
 *    do right now (step 8 below is for stages with no candidate-side action)
 * 8. Backend-provided workflow action (fallback, for every other stage --
 *    these are staff/system-driven waits with nothing for the candidate to
 *    do, so the message only names the stage, not an action)
 */
export function resolveNextAction(
  progress: ApplicationProgress,
  checklist: CandidateDocumentChecklistItem[]
): NextAction {
  const requiredItems = checklist.filter((item) => item.required);

  const rejectedReplaceable = requiredItems.find((item) => item.status === 'rejected' && item.replacementAllowed);
  if (rejectedReplaceable) return { kind: 'rejected_replaceable', requirementName: rejectedReplaceable.name };

  const missingRequirements = requiredItems.filter((item) => item.status === 'missing');
  if (missingRequirements.length > 0) {
    // Naming one specific document ("Upload your missing document: Certificates")
    // is only helpful once the candidate has made some progress -- when nothing
    // required has been submitted at all yet (every required item is still
    // 'missing'), singling out whichever one happens to sort first is
    // misleading, since it reads as if the others are already done.
    if (missingRequirements.length === requiredItems.length) {
      return { kind: 'no_documents_uploaded' };
    }
    return { kind: 'missing_required', requirementName: missingRequirements[0].name };
  }

  const expiredPccReplaceable = requiredItems.find(
    (item) => item.document?.complianceStatus === 'expired' && item.replacementAllowed
  );
  if (expiredPccReplaceable) return { kind: 'expired_pcc_replaceable', requirementName: expiredPccReplaceable.name };

  const documents = progress.documents;
  if (documents.canSubmit) return { kind: 'ready_to_submit' };
  if (documents.pendingReview > 0) return { kind: 'awaiting_review' };
  // `documents.submissionState` stays 'verified' forever once verification
  // happens -- nothing un-verifies it as the candidate moves on to later
  // stages (fee_pending, fee_paid, ...). Without gating on the *current*
  // workflow stage too, this step would keep announcing "verification
  // complete" as the next action long after it stopped being the next
  // anything, hiding the real next step (e.g. paying the fee) behind a
  // stale message. Only step 7's workflow_stage fallback should fire once
  // the candidate has moved past the verified stage itself.
  if (documents.submissionState === 'verified' && progress.currentWorkflowStage?.code === 'verified') {
    return { kind: 'verified' };
  }

  if (progress.currentWorkflowStage?.code === 'fee_pending') {
    return { kind: 'pay_fee' };
  }

  return { kind: 'workflow_stage', requirementName: progress.currentWorkflowStage?.name };
}

export const NEXT_ACTION_KEYS: Record<NextActionKind, string> = {
  rejected_replaceable: 'applicationProgressNextActionRejectedReplaceable',
  no_documents_uploaded: 'applicationProgressNextActionNoDocuments',
  missing_required: 'applicationProgressNextActionMissing',
  expired_pcc_replaceable: 'applicationProgressNextActionExpiredPcc',
  ready_to_submit: 'applicationProgressNextActionReadyToSubmit',
  awaiting_review: 'applicationProgressNextActionAwaitingReview',
  verified: 'applicationProgressNextActionVerified',
  pay_fee: 'applicationProgressNextActionPayFee',
  workflow_stage: 'applicationProgressNextActionWorkflowFallback',
};

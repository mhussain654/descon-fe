// Translation keys for the workflow-transition `blocking_reasons` codes the
// backend can return for the `documents_shared_with_qatar_bu` transition
// specifically (descon-be's CandidateWorkflows::PrerequisiteValidator
// `fee_paid_result`/`verified_documents_result`, which the Qatar BU
// transition shares with `fee_paid`): 'required_documents_not_verified',
// 'expired_pcc', 'payment_required'. 'unknown' is the safe fallback for any
// other stage's blocking reason surfacing here unexpectedly (e.g. once a
// future transition reuses this same list-rendering code) -- never render
// a raw blocking-reason code to staff.
export type WorkflowBlockingReason =
  | 'required_documents_not_verified'
  | 'expired_pcc'
  | 'payment_required'
  | 'documents_required'
  | 'unknown';

export function toWorkflowBlockingReason(raw: string): WorkflowBlockingReason {
  switch (raw) {
    case 'required_documents_not_verified':
    case 'expired_pcc':
    case 'payment_required':
    case 'documents_required':
      return raw;
    default:
      return 'unknown';
  }
}

export const WORKFLOW_BLOCKING_REASON_KEYS: Record<WorkflowBlockingReason, string> = {
  required_documents_not_verified: 'adminWorkflowBlockingReasonDocumentsNotVerified',
  expired_pcc: 'candidateDocumentsPccExpired',
  payment_required: 'adminWorkflowBlockingReasonPaymentRequired',
  documents_required: 'adminWorkflowBlockingReasonDocumentsRequired',
  unknown: 'adminWorkflowBlockingReasonUnknown',
};

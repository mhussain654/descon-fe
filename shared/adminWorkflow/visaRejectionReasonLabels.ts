// Translation keys for a visa decision's structured rejection reason
// (CandidateVisaDecision::REJECTION_REASON_CODES) -- a raw backend code must
// never render untranslated, same rule as WORKFLOW_BLOCKING_REASON_KEYS and
// QVC_ATTEMPT_STATUS_KEYS.
import { VISA_REJECTION_REASON_CODES, type VisaRejectionReasonCode } from './types';

export const VISA_REJECTION_REASON_KEYS: Record<VisaRejectionReasonCode, string> = {
  document_discrepancy: 'adminWorkflowVisaRejectionDocumentDiscrepancy',
  medical_issue: 'adminWorkflowVisaRejectionMedicalIssue',
  security_clearance: 'adminWorkflowVisaRejectionSecurityClearance',
  embassy_rejection: 'adminWorkflowVisaRejectionEmbassyRejection',
  incomplete_application: 'adminWorkflowVisaRejectionIncompleteApplication',
  other: 'adminWorkflowVisaRejectionOther',
};

/** Options for the rejection-reason select, in the backend's declared order. */
export const VISA_REJECTION_REASON_SELECT_VALUES: readonly VisaRejectionReasonCode[] = VISA_REJECTION_REASON_CODES;

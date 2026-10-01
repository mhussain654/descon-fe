// Display metadata for a visa decision's outcome -- mirrors
// shared/candidateWorkflow/qvcOutcome.ts's QVC_OUTCOME_KEYS/TONES pattern.
import type { VisaDecisionOutcomeCode } from './types';

export const VISA_OUTCOME_KEYS: Record<VisaDecisionOutcomeCode, string> = {
  issued: 'visaOutcomeIssued',
  rejected: 'visaOutcomeRejected',
};

export const VISA_OUTCOME_TONES: Record<VisaDecisionOutcomeCode, 'success' | 'danger'> = {
  issued: 'success',
  rejected: 'danger',
};

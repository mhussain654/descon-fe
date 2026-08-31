// Translation keys for a QVC attempt's status/outcome code
// (CandidateQvcAttempt::OUTCOME_CODES plus the client-visible `scheduled`/
// `no_show` states) -- a raw backend code must never render untranslated,
// same rule as WORKFLOW_BLOCKING_REASON_KEYS.
import type { QvcAttemptStatus, QvcOutcomeCode } from './types';

export const QVC_ATTEMPT_STATUS_KEYS: Record<QvcAttemptStatus, string> = {
  scheduled: 'adminWorkflowQvcStatusScheduled',
  approved: 'adminWorkflowQvcStatusApproved',
  re_medical: 'adminWorkflowQvcStatusReMedical',
  rejected: 'adminWorkflowQvcStatusRejected',
  no_show: 'adminWorkflowQvcStatusNoShow',
};

/** Options for the outcome-recording select -- deliberately excludes `scheduled` (not a recordable outcome) and represents no-show as its own selectable value even though the backend takes it as a separate `no_show` boolean flag, not an `outcome_code`. */
export const QVC_OUTCOME_SELECT_VALUES: readonly (QvcOutcomeCode | 'no_show')[] = [
  'approved',
  're_medical',
  'rejected',
  'no_show',
];

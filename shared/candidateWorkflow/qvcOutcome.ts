// Pure lookup over the workflow history for the QVC ("Qualification/Visa
// Center") appointment outcome (ticket MPS-501) -- the only place this
// evidence exists is the specific transition that recorded it, never the
// Status screen's own timeline snapshot. Never infer or guess an outcome:
// only ever surface what the backend actually recorded.
import type { QvcOutcomeCode, WorkflowHistoryItem } from './types';

export interface QvcOutcome {
  code: QvcOutcomeCode;
  /** ISO 8601 date, when the backend provided one. */
  date?: string;
}

const QVC_OUTCOME_STAGE_CODE = 'qvc_completed_outcome_received';

/** The most recent transition into the QVC-outcome stage that actually carried outcome evidence -- later re-submissions (e.g. after a `re_medical_required` outcome) take precedence over an earlier one. */
export function findLatestQvcOutcome(items: WorkflowHistoryItem[]): QvcOutcome | null {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item.toStage.code !== QVC_OUTCOME_STAGE_CODE) continue;
    if (!item.details?.qvcOutcomeCode) continue;

    return { code: item.details.qvcOutcomeCode, date: item.details.qvcOutcomeDate };
  }
  return null;
}

export const QVC_OUTCOME_KEYS: Record<QvcOutcomeCode, string> = {
  approved: 'qvcOutcomeApproved',
  re_medical_required: 'qvcOutcomeReMedicalRequired',
  rejected: 'qvcOutcomeRejected',
};

export const QVC_OUTCOME_TONES: Record<QvcOutcomeCode, 'success' | 'warning' | 'danger'> = {
  approved: 'success',
  re_medical_required: 'warning',
  rejected: 'danger',
};

// What a candidate sees in "My Journey": only the milestones they complete
// (documents uploaded, documents verified, medical completed, e-number
// received, fee paid, visa decision ...). A waiting state that is also a
// canonical stage ("documents pending", "under verification", "fee
// pending" ...) is never a list row -- it is shown once, as the candidate's
// current status (see currentDashboardStage.ts). The backend timeline is untouched; this only decides what
// the candidate-facing screens show from it.
import type { WorkflowTimelineStage } from './types';

export const WAITING_STAGE_CODES: ReadonlySet<string> = new Set([
  'documents_pending',
  'under_verification',
  'medical_pending',
  'medical_appointment',
  'gamca_medical_pending',
  'e_number_processing',
  'fee_pending',
  'visa_processing',
]);

export interface JourneyProgress {
  /** The milestones only, numbered 1..n so the list has no gaps where a waiting stage was. */
  milestones: WorkflowTimelineStage[];
  completedCount: number;
  totalCount: number;
  /** Whole percent of milestones completed. */
  percentage: number;
}

export function journeyProgress(timeline: WorkflowTimelineStage[]): JourneyProgress {
  const milestones = timeline
    .filter((stage) => !WAITING_STAGE_CODES.has(stage.code))
    .map((stage, index) => ({ ...stage, position: index + 1 }));
  const completedCount = milestones.filter((stage) => stage.status === 'completed').length;
  const totalCount = milestones.length;
  return {
    milestones,
    completedCount,
    totalCount,
    percentage: totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100),
  };
}

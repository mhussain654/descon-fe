// Pure computation for the candidate Status screen's approved-prototype
// timeline (registered → documents pending → uploaded → verified → ...).
// The prototype's own 14-stage timeline is a static mock; only the first 4
// stages have any real backend signal behind them (from `ApplicationProgress.documents.submissionState`).
// The remaining 10 (fee/QVC/visa/mobilization) have no field anywhere in
// this contract, so they always render as plain, un-dated, never-"current"
// upcoming stages -- never fabricated as reached.
import type { ApplicationProgress, ApplicationSubmissionDisplayState } from './types';

export type TimelineStageStatus = 'completed' | 'current' | 'pending';

export interface TimelineStage {
  labelKey: string;
  status: TimelineStageStatus;
}

/** Order matches the approved prototype exactly -- never reorder or rename these label keys. */
const DOWNSTREAM_LABEL_KEYS = [
  'feePending',
  'feePaid',
  'sharedWithBU',
  'qvcBooked',
  'qvcOutcome',
  'visaIssued',
  'protectionCompleted',
  'readyToFly',
  'flightDetailsUploaded',
  'mobilized',
] as const;

const UPLOADED_OR_LATER: ReadonlySet<ApplicationSubmissionDisplayState> = new Set([
  'submitted',
  'partially_verified',
  'verified',
  'changes_required',
]);

function documentsUploadedStage(state: ApplicationSubmissionDisplayState, hasRequirements: boolean): TimelineStage {
  if (UPLOADED_OR_LATER.has(state)) return { labelKey: 'documentsUploaded', status: 'completed' };
  if (hasRequirements && (state === 'incomplete' || state === 'ready')) {
    return { labelKey: 'documentsUploaded', status: 'current' };
  }
  return { labelKey: 'documentsUploaded', status: 'pending' };
}

function documentsVerifiedStage(state: ApplicationSubmissionDisplayState): TimelineStage {
  if (state === 'verified') return { labelKey: 'documentsVerified', status: 'completed' };
  if (state === 'submitted' || state === 'partially_verified') return { labelKey: 'documentsVerified', status: 'current' };
  return { labelKey: 'documentsVerified', status: 'pending' };
}

export function buildStatusTimeline(progress: ApplicationProgress): TimelineStage[] {
  const state = progress.documents.submissionState;
  const hasRequirements = state !== 'no_assignment' && state !== 'no_requirements';

  return [
    { labelKey: 'registered', status: 'completed' },
    { labelKey: 'documentsPending', status: hasRequirements ? 'completed' : 'current' },
    documentsUploadedStage(state, hasRequirements),
    documentsVerifiedStage(state),
    ...DOWNSTREAM_LABEL_KEYS.map((labelKey) => ({ labelKey, status: 'pending' as const })),
  ];
}

export interface DashboardStage {
  labelKey: string;
  /** True when this is the timeline's `current` (in-progress, not yet reached) stage -- the Dashboard summary must say so rather than implying the stage is done, since several labelKeys (e.g. `documentsVerified`, whose English text is bare "Verified") read as a completed state on their own. */
  inProgress: boolean;
}

/**
 * The single stage the Dashboard's "Current Status" card summarizes as
 * "where the candidate is right now" -- the timeline's own `current` stage,
 * or (once every stage with real backend signal is `completed`, e.g. fully
 * verified) the last `completed` one, so the summary never regresses to
 * "Registered" once real progress has been made. Falls back to the first
 * stage only for an empty timeline, which `buildStatusTimeline` never
 * actually produces.
 */
export function currentDashboardStage(timeline: TimelineStage[]): DashboardStage {
  const current = timeline.find((stage) => stage.status === 'current');
  if (current) return { labelKey: current.labelKey, inProgress: true };

  const lastCompleted = [...timeline].reverse().find((stage) => stage.status === 'completed');
  return { labelKey: lastCompleted?.labelKey ?? timeline[0]?.labelKey ?? 'registered', inProgress: false };
}

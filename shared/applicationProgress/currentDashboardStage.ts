// Pure presentation logic over the real, backend-authoritative 15-stage
// workflow timeline (ticket MPS-501) -- picks the single stage the
// Dashboard's "Current Status" card headlines as "where the candidate is
// right now". This never invents, reorders or re-derives a stage: it only
// selects one of the stages the backend already returned.
import type { WorkflowTimelineStage } from './types';

export interface DashboardStage {
  /** Already localized server-side -- render directly, never look up a local translation key. */
  name: string;
  /** True when this is the timeline's `current` (in-progress, not yet reached) stage -- the caller must say so rather than implying the stage is done, since a stage in progress can still read as complete on its own (e.g. "Verified"). */
  inProgress: boolean;
}

/**
 * The timeline's own `current` stage, or (once every stage is `completed`,
 * i.e. the workflow has reached its terminal `mobilized` stage) the last
 * `completed` one, so the summary never regresses to an earlier stage once
 * real progress has been made. Returns null only for an empty timeline,
 * which the real backend never actually returns.
 */
export function currentDashboardStage(timeline: WorkflowTimelineStage[]): DashboardStage | null {
  const current = timeline.find((stage) => stage.status === 'current');
  if (current) return { name: current.name, inProgress: true };

  const lastCompleted = [...timeline].reverse().find((stage) => stage.status === 'completed');
  if (lastCompleted) return { name: lastCompleted.name, inProgress: false };

  return null;
}

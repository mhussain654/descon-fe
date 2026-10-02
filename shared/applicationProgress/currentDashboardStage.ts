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

/**
 * The next stage still ahead of the candidate -- the first `pending` stage
 * after the current (or, if none is current, the last completed) one -- so
 * the home screen can say what happens next rather than repeating where the
 * candidate already is. Null once nothing is left (mobilized).
 */
export function upcomingDashboardStage(timeline: WorkflowTimelineStage[]): DashboardStage | null {
  const ordered = [...timeline].sort((a, b) => a.position - b.position);
  const anchor =
    ordered.find((stage) => stage.status === 'current') ??
    [...ordered].reverse().find((stage) => stage.status === 'completed');
  const next = ordered.find(
    (stage) => stage.status === 'pending' && (!anchor || stage.position > anchor.position)
  );
  return next ? { name: next.name, inProgress: false } : null;
}

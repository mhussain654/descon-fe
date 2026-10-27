// Which workflow-stage transitions read as a real, completed action or
// outcome ("documents uploaded", "fee paid", "visa issued") versus a mere
// waiting/in-progress state ("documents pending", "under verification",
// "fee pending") that happens to also be a canonical stage. The "Recent
// updates" history list only shows the former -- every waiting state is
// already visible as the *current* position in the stepper immediately
// above it, so repeating it in the history list under a "completed" heading
// reads as if something happened when nothing did. The waiting stages are
// the same ones "My Journey" leaves out of its list (journeyMilestones.ts).
import { WAITING_STAGE_CODES } from '../applicationProgress/journeyMilestones';
import type { WorkflowHistoryItem } from './types';

export function isActionableHistoryItem(item: WorkflowHistoryItem): boolean {
  return !WAITING_STAGE_CODES.has(item.toStage.code);
}

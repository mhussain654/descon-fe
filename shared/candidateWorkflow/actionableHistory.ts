// Which workflow-stage transitions read as a real, completed action or
// outcome ("documents uploaded", "fee paid", "visa issued") versus a mere
// waiting/in-progress state ("documents pending", "under verification",
// "fee pending") that happens to also be a canonical stage. The "Recent
// updates" history list only shows the former -- every waiting state is
// already visible as the *current* position in the stepper immediately
// above it, so repeating it in the history list under a "completed" heading
// reads as if something happened when nothing did.
import type { WorkflowHistoryItem } from './types';

const NON_ACTIONABLE_STAGE_CODES = new Set(['documents_pending', 'under_verification', 'fee_pending']);

export function isActionableHistoryItem(item: WorkflowHistoryItem): boolean {
  return !NON_ACTIONABLE_STAGE_CODES.has(item.toStage.code);
}

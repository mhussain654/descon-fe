import type { AllowedWorkflowTransition } from '../../../../../../shared/adminWorkflow/types';

/**
 * `allowed_next_transitions` evaluates every stage's prerequisites using
 * *empty* evidence (it has no request-scoped evidence to check against a
 * hypothetical future submission), so a stage whose only requirements are
 * its own evidence fields always comes back `allowed: false` with exactly
 * those fields' `<field>_required` blocking reasons -- confirmed live
 * against the real backend during MPS-F501 Phase B. That is not a genuine
 * prerequisite failure; it is simply "provide the evidence," which is
 * exactly what the action's own form/dialog is for. Only a blocking reason
 * outside `ownEvidenceFields` (e.g. `visa_issued_required`) represents a
 * real block. Generalizes WorkflowPanel.tsx's original single-field
 * ProtectionTransitionCard check for panels needing more than one evidence
 * field (visa: outcome_code + decision_date; flight: airline + flight_number
 * + sector + flight_date; mobilization: mobilized_on).
 */
export function blockedOnlyByEvidenceFields(transition: AllowedWorkflowTransition, ownEvidenceFields: readonly string[]): boolean {
  if (transition.allowed || transition.blockingReasons.length === 0) return false;
  const ownReasons = new Set(ownEvidenceFields.map((field) => `${field}_required`));
  return transition.blockingReasons.every((reason) => ownReasons.has(reason));
}

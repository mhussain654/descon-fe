import type { CandidateProfile } from './types';

// Kept for the one case candidateStatusLabel itself falls back to (no
// assignment/workflow stage yet, so there is no localized name to borrow --
// see that function's own comment) and for direct callers that only have a
// bare code, not a full CandidateProfile.
export function humanizeStatusCode(code: string): string {
  return code
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * A localized label for `candidateStatus`. The backend keeps `status_code`
 * and `current_workflow_stage.code` in lockstep -- every transition writes
 * both together in the same call (see
 * CandidateWorkflows::TransitionService#apply_transition!,
 * `candidate.update!(status_code: destination_stage.code)`), and every
 * transition path (manual or automatic) goes through that one method. So
 * whenever the codes match, `currentWorkflowStage.name` -- the localized
 * WorkflowStage name the backend already sends -- is exactly the right
 * label, with no separate backend field needed.
 *
 * Falls back to a plain humanization only for the one case where that
 * assumption doesn't hold: no assignment/workflow stage yet, or (should the
 * two ever genuinely diverge) a mismatched code -- rendering the safe,
 * locale-agnostic form rather than silently trusting a value that isn't
 * actually confirmed to be this status's translation.
 */
export function candidateStatusLabel(
  profile: Pick<CandidateProfile, 'candidateStatus' | 'currentWorkflowStage'>
): string {
  if (profile.currentWorkflowStage?.code === profile.candidateStatus) {
    return profile.currentWorkflowStage.name;
  }
  return humanizeStatusCode(profile.candidateStatus);
}

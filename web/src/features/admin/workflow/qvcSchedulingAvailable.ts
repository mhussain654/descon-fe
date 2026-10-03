import type { AdminQvcAttempt, AdminWorkflowState, AllowedWorkflowTransitions } from '../../../../../shared/adminWorkflow/types';

/** Initial scheduling follows returned transitions; follow-ups remain at the current QVC stage. */
export function qvcSchedulingAvailable(
  state: AdminWorkflowState,
  transitions: AllowedWorkflowTransitions,
  attempts: AdminQvcAttempt[],
): boolean {
  if (attempts.some((attempt) => attempt.status === 'scheduled')) return false;

  const appointment = transitions.allowedNextTransitions.find((item) => item.actionType === 'qvc_appointment');
  if (appointment && (appointment.allowed || (
    appointment.blockingReasons.length > 0 &&
    appointment.blockingReasons.every((reason) => reason === 'appointment_date_required')
  ))) return true;

  const latest = attempts.reduce<AdminQvcAttempt | undefined>(
    (result, attempt) => !result || attempt.attemptNumber > result.attemptNumber ? attempt : result,
    undefined,
  );
  if (!latest) return false;
  return (state.currentStage?.actionType === 'qvc_appointment' && latest.status === 'no_show') ||
    (state.currentStage?.actionType === 'qvc_outcome' && latest.status === 're_medical');
}

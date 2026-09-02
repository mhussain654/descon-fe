// Derives the candidate's onboarding-fee payment status for admin display
// from the real workflow-state timeline (WorkflowTimelineStage[], from
// GET /admin/candidates/:id/workflow_state) -- there is no admin/staff
// payment-status endpoint (the only payment API,
// GET/POST /api/v1/candidate/payment, is candidate-self-service only), so
// this reuses the *real*, already-fetched stage-progression data rather than
// inventing a backend contract that doesn't exist. `fee_paid` being
// 'current' or 'completed' means the fee has genuinely been paid -- the
// backend only ever transitions a candidate into that stage after a
// confirmed payment (see Payments::EligibilityService); it's never reached
// any other way.
import type { WorkflowTimelineStage } from './types';

export type CandidatePaymentStatus = 'not_reached' | 'pending' | 'paid';

export function paymentStatusFromTimeline(timeline: WorkflowTimelineStage[]): CandidatePaymentStatus {
  const feePaid = timeline.find((stage) => stage.code === 'fee_paid');
  if (feePaid && (feePaid.status === 'completed' || feePaid.status === 'current')) return 'paid';

  const feePending = timeline.find((stage) => stage.code === 'fee_pending');
  if (feePending && feePending.status === 'current') return 'pending';

  return 'not_reached';
}

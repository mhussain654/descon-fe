import type { ApplicationSubmissionDisplayState, BlockingRequirementDisplayReason } from './types';

/** Maps every possible submission-state display value (including the `'unknown'` fallback) to its translation key. Never render `submissionState` directly -- always go through this map (ticket: "Treat unknown future states safely and never display raw codes."). */
export const APPLICATION_SUBMISSION_STATE_KEYS: Record<ApplicationSubmissionDisplayState, string> = {
  no_assignment: 'applicationProgressStateNoAssignment',
  no_requirements: 'applicationProgressStateNoRequirements',
  incomplete: 'applicationProgressStateIncomplete',
  ready: 'applicationProgressStateReady',
  submitted: 'applicationProgressStateSubmitted',
  partially_verified: 'applicationProgressStatePartiallyVerified',
  verified: 'applicationProgressStateVerified',
  changes_required: 'applicationProgressStateChangesRequired',
  unknown: 'applicationProgressStateUnknown',
};

export type ApplicationSubmissionStateTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

/** Suggested visual treatment: no_assignment/no_requirements are informative empty states (neutral); incomplete needs action (warning); ready/submitted/partially_verified are informational progress (info); verified is success; changes_required needs action (danger, since it means a rejection). */
export const APPLICATION_SUBMISSION_STATE_TONES: Record<ApplicationSubmissionDisplayState, ApplicationSubmissionStateTone> = {
  no_assignment: 'neutral',
  no_requirements: 'neutral',
  incomplete: 'warning',
  ready: 'info',
  submitted: 'info',
  partially_verified: 'info',
  verified: 'success',
  changes_required: 'danger',
  unknown: 'neutral',
};

/** Maps every possible blocking-requirement reason (including the `'unknown'` fallback) to its translation key. */
export const BLOCKING_REQUIREMENT_REASON_KEYS: Record<BlockingRequirementDisplayReason, string> = {
  missing: 'applicationProgressBlockerReasonMissing',
  rejected: 'applicationProgressBlockerReasonRejected',
  unknown: 'applicationProgressBlockerReasonUnknown',
};

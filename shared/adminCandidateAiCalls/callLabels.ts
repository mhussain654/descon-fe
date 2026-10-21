// Pure label/tone lookups for the admin candidate AI call history/trigger
// UI. `trigger`/`outcome`/`verification_status` are fixed backend
// enums (the serializer's trigger values, AiCalls::OutcomeMapper's outcome
// values, CandidateAiCall::VERIFICATION_STATUSES) -- exhaustive maps, not
// humanize-fallback ones,
// since an unrecognized value here is a genuine frontend/backend contract
// drift, not an expected free-form code (unlike Communication's channel/
// status_code, see communicationLabels.ts).
//
// `status` reuses communicationStatusLabel/Tone directly rather than
// duplicating it -- CandidateAiCall::STATUSES and the values
// Communication#status_code takes for the ai_voice_call channel are the
// same 8-value set by construction (see record_post_call_webhook_service.rb).
import type { TranslationKey } from '../i18n/translations';
import type { AdminAiCallOutcome, AdminAiCallOutcomeReason, AdminAiCallTrigger, AdminAiCallVerificationStatus } from './types';

export { communicationStatusLabel as adminAiCallStatusLabel, communicationStatusTone as adminAiCallStatusTone } from '../adminCommunications/communicationLabels';

const OUTCOME_KEYS: Record<AdminAiCallOutcome, TranslationKey> = {
  answered: 'adminCandidateAiCallOutcomeAnswered',
  not_answered: 'adminCandidateAiCallOutcomeNotAnswered',
  callback_required: 'adminCandidateAiCallOutcomeCallbackRequired',
};

const OUTCOME_TONES: Record<AdminAiCallOutcome, 'success' | 'warning' | 'neutral'> = {
  answered: 'success',
  not_answered: 'neutral',
  callback_required: 'warning',
};

const OUTCOME_REASON_KEYS: Record<AdminAiCallOutcomeReason, TranslationKey> = {
  resolved: 'adminCandidateAiCallOutcomeReasonResolved',
  unresolved: 'adminCandidateAiCallOutcomeReasonUnresolved',
  candidate_requested: 'adminCandidateAiCallOutcomeReasonCandidateRequested',
  agent_escalation: 'adminCandidateAiCallOutcomeReasonAgentEscalation',
  busy: 'adminCandidateAiCallOutcomeReasonBusy',
  no_answer: 'adminCandidateAiCallOutcomeReasonNoAnswer',
  voicemail: 'adminCandidateAiCallOutcomeReasonVoicemail',
  provider_failure: 'adminCandidateAiCallOutcomeReasonProviderFailure',
  needs_manual_review: 'adminCandidateAiCallOutcomeReasonNeedsManualReview',
};

const VERIFICATION_STATUS_KEYS: Record<AdminAiCallVerificationStatus, TranslationKey> = {
  not_applicable: 'adminCandidateAiCallVerificationNotApplicable',
  pending: 'adminCandidateAiCallVerificationPending',
  verified: 'adminCandidateAiCallVerificationVerified',
  failed: 'adminCandidateAiCallVerificationFailed',
  skipped: 'adminCandidateAiCallVerificationSkipped',
};

const TRIGGER_KEYS: Record<AdminAiCallTrigger, TranslationKey> = {
  manual: 'adminCandidateAiCallTriggerManual',
  automatic: 'adminCandidateAiCallTriggerAutomatic',
  bulk: 'adminCandidateAiCallTriggerBulk',
};

export function adminAiCallTriggerLabel(trigger: AdminAiCallTrigger, t: (key: TranslationKey) => string): string {
  return t(TRIGGER_KEYS[trigger]);
}

export function adminAiCallOutcomeLabel(outcome: AdminAiCallOutcome, t: (key: TranslationKey) => string): string {
  return t(OUTCOME_KEYS[outcome]);
}

export function adminAiCallOutcomeTone(outcome: AdminAiCallOutcome): 'success' | 'warning' | 'neutral' {
  return OUTCOME_TONES[outcome];
}

export function adminAiCallOutcomeReasonLabel(reason: AdminAiCallOutcomeReason, t: (key: TranslationKey) => string): string {
  return t(OUTCOME_REASON_KEYS[reason]);
}

export function adminAiCallVerificationStatusLabel(status: AdminAiCallVerificationStatus, t: (key: TranslationKey) => string): string {
  return t(VERIFICATION_STATUS_KEYS[status]);
}

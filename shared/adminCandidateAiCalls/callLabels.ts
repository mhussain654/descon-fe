// Pure label/tone lookups for the admin candidate AI call history/trigger
// UI. `call_reason`/`outcome`/`verification_status` are fixed backend
// enums (AdminCandidateAiCallRequest's call_reason enum,
// AiCalls::OutcomeMapper's outcome values, CandidateAiCall::
// VERIFICATION_STATUSES) -- exhaustive maps, not humanize-fallback ones,
// since an unrecognized value here is a genuine frontend/backend contract
// drift, not an expected free-form code (unlike Communication's channel/
// status_code, see communicationLabels.ts).
//
// `status` reuses communicationStatusLabel/Tone directly rather than
// duplicating it -- CandidateAiCall::STATUSES and the values
// Communication#status_code takes for the ai_voice_call channel are the
// same 8-value set by construction (see record_post_call_webhook_service.rb).
import type { TranslationKey } from '../i18n/translations';
import type { AdminAiCallOutcome, AdminAiCallReason, AdminAiCallVerificationStatus } from './types';

export { communicationStatusLabel as adminAiCallStatusLabel, communicationStatusTone as adminAiCallStatusTone } from '../adminCommunications/communicationLabels';

const CALL_REASON_KEYS: Record<AdminAiCallReason, TranslationKey> = {
  missing_documents: 'adminCandidateAiCallReasonMissingDocuments',
  protection_appearance_reminder: 'adminCandidateAiCallReasonProtectionAppearanceReminder',
  urgent_compliance_action: 'adminCandidateAiCallReasonUrgentComplianceAction',
  flight_information: 'adminCandidateAiCallReasonFlightInformation',
};

/** One dedicated, fully-static confirm-description key per reason -- mirrors WorkflowPanel.tsx's "pick between a small set of static keys" convention rather than interpolating a value into translated prose. */
const CALL_REASON_CONFIRM_DESCRIPTION_KEYS: Record<AdminAiCallReason, TranslationKey> = {
  missing_documents: 'adminCandidateAiCallConfirmDescriptionMissingDocuments',
  protection_appearance_reminder: 'adminCandidateAiCallConfirmDescriptionProtectionAppearanceReminder',
  urgent_compliance_action: 'adminCandidateAiCallConfirmDescriptionUrgentComplianceAction',
  flight_information: 'adminCandidateAiCallConfirmDescriptionFlightInformation',
};

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

const VERIFICATION_STATUS_KEYS: Record<AdminAiCallVerificationStatus, TranslationKey> = {
  not_applicable: 'adminCandidateAiCallVerificationNotApplicable',
  pending: 'adminCandidateAiCallVerificationPending',
  verified: 'adminCandidateAiCallVerificationVerified',
  failed: 'adminCandidateAiCallVerificationFailed',
  skipped: 'adminCandidateAiCallVerificationSkipped',
};

export function adminAiCallReasonLabel(reason: AdminAiCallReason, t: (key: TranslationKey) => string): string {
  return t(CALL_REASON_KEYS[reason]);
}

export function adminAiCallConfirmDescription(reason: AdminAiCallReason, t: (key: TranslationKey) => string): string {
  return t(CALL_REASON_CONFIRM_DESCRIPTION_KEYS[reason]);
}

export function adminAiCallOutcomeLabel(outcome: AdminAiCallOutcome, t: (key: TranslationKey) => string): string {
  return t(OUTCOME_KEYS[outcome]);
}

export function adminAiCallOutcomeTone(outcome: AdminAiCallOutcome): 'success' | 'warning' | 'neutral' {
  return OUTCOME_TONES[outcome];
}

export function adminAiCallVerificationStatusLabel(status: AdminAiCallVerificationStatus, t: (key: TranslationKey) => string): string {
  return t(VERIFICATION_STATUS_KEYS[status]);
}

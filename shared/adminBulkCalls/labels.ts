// Pure label/tone lookups for the bulk-call page. Item statuses and call states
// are fixed backend enums (BulkCallBatchItem::STATUSES, the candidate rows'
// call_state); a skip reason or outcome reason this build does not know falls
// back to its raw code rather than a blank cell.
import type { TranslationKey } from '../i18n/translations';
import { adminAiCallOutcomeLabel, adminAiCallOutcomeTone } from '../adminCandidateAiCalls/callLabels';
import type { AdminAiCallOutcome } from '../adminCandidateAiCalls/types';
import type { BulkCallItemStatus, BulkCallState } from './types';

export type BulkCallTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const CALL_STATE_KEYS: Record<BulkCallState, TranslationKey> = {
  not_called: 'adminBulkCallStateNotCalled',
  queued: 'adminBulkCallStateQueued',
  called: 'adminBulkCallStateCalled',
};

const CALL_STATE_TONES: Record<BulkCallState, BulkCallTone> = { not_called: 'neutral', queued: 'info', called: 'success' };

const ITEM_STATUS_KEYS: Record<BulkCallItemStatus, TranslationKey> = {
  queued: 'adminBulkCallItemQueued',
  placed: 'adminBulkCallItemPlaced',
  skipped: 'adminBulkCallItemSkipped',
  failed: 'adminBulkCallItemFailed',
};

const ITEM_STATUS_TONES: Record<BulkCallItemStatus, BulkCallTone> = { queued: 'info', placed: 'success', skipped: 'warning', failed: 'danger' };

const SKIP_REASON_KEYS: Record<string, TranslationKey> = {
  stage_changed: 'adminBulkCallSkipStageChanged',
  candidate_inactive: 'adminBulkCallSkipCandidateInactive',
  no_assignment: 'adminBulkCallSkipNoAssignment',
  outside_calling_hours: 'adminBulkCallSkipOutsideHours',
  daily_limit_reached: 'adminBulkCallSkipDailyLimit',
  calling_disabled: 'adminBulkCallSkipCallingDisabled',
  provider_error: 'adminBulkCallSkipProviderError',
};

const OUTCOME_REASON_KEYS: Record<string, TranslationKey> = {
  resolved: 'adminCandidateAiCallOutcomeReasonResolved',
  candidate_requested: 'adminCandidateAiCallOutcomeReasonCandidateRequested',
  busy: 'adminCandidateAiCallOutcomeReasonBusy',
  no_answer: 'adminCandidateAiCallOutcomeReasonNoAnswer',
  voicemail: 'adminCandidateAiCallOutcomeReasonVoicemail',
  provider_failure: 'adminCandidateAiCallOutcomeReasonProviderFailure',
  needs_manual_review: 'adminCandidateAiCallOutcomeReasonNeedsManualReview',
  hangup: 'adminBulkCallReasonHangup',
};

const KNOWN_OUTCOMES: readonly string[] = ['answered', 'not_answered', 'callback_required'];

export function bulkCallStateLabel(state: BulkCallState, t: (key: TranslationKey) => string): string {
  return t(CALL_STATE_KEYS[state]);
}

export function bulkCallStateTone(state: BulkCallState): BulkCallTone {
  return CALL_STATE_TONES[state];
}

export function bulkCallItemStatusLabel(status: BulkCallItemStatus, t: (key: TranslationKey) => string): string {
  return t(ITEM_STATUS_KEYS[status]);
}

export function bulkCallItemStatusTone(status: BulkCallItemStatus): BulkCallTone {
  return ITEM_STATUS_TONES[status];
}

export function bulkCallSkipReasonLabel(reason: string, t: (key: TranslationKey) => string): string {
  const key = SKIP_REASON_KEYS[reason];
  return key ? t(key) : reason;
}

/** "Answered" or "Not answered -- No answer"; empty until the call has an outcome. */
export function bulkCallOutcomeText(outcome: string | undefined, reason: string | undefined, t: (key: TranslationKey) => string): string {
  if (!outcome) return '';
  const label = KNOWN_OUTCOMES.includes(outcome) ? adminAiCallOutcomeLabel(outcome as AdminAiCallOutcome, t) : outcome;
  if (!reason) return label;
  const reasonKey = OUTCOME_REASON_KEYS[reason];
  return `${label} -- ${reasonKey ? t(reasonKey) : reason}`;
}

export function bulkCallOutcomeTone(outcome: string | undefined): BulkCallTone {
  return outcome && KNOWN_OUTCOMES.includes(outcome) ? adminAiCallOutcomeTone(outcome as AdminAiCallOutcome) : 'neutral';
}

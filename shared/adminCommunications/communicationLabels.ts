// Pure label/tone lookups for the admin communications log, mirroring
// shared/adminPayments/paymentLabels.ts's identical pattern. channel_code/
// status_code are free-form on the backend (format-checked only, no fixed
// enum -- every channel defines its own vocabulary), so an unrecognized
// value falls back to a humanized version of the raw code rather than
// crashing or showing a raw translation-key string.
import type { TranslationKey } from '../i18n/translations';

// The only channel that writes Communication rows today (Phase 1-4 of the
// AI Voice Calling feature); sms/email/notification are a separate,
// not-yet-built feature (see the plan's "Automated AI Messages", out of
// scope here) -- their codes will simply humanize until they're added.
const KNOWN_CHANNEL_KEYS: Partial<Record<string, TranslationKey>> = {
  ai_voice_call: 'adminCommunicationChannelAiVoiceCall',
};

// Matches CandidateAiCall::STATUSES exactly (the only writer of
// Communication#status_code today).
const KNOWN_STATUS_KEYS: Partial<Record<string, TranslationKey>> = {
  requested: 'adminCommunicationStatusRequested',
  queued: 'adminCommunicationStatusQueued',
  ringing: 'adminCommunicationStatusRinging',
  in_progress: 'adminCommunicationStatusInProgress',
  processing: 'adminCommunicationStatusProcessing',
  completed: 'adminCommunicationStatusCompleted',
  failed: 'adminCommunicationStatusFailed',
  cancelled: 'adminCommunicationStatusCancelled',
};

const STATUS_TONES: Partial<Record<string, 'neutral' | 'info' | 'success' | 'danger'>> = {
  requested: 'neutral',
  queued: 'info',
  ringing: 'info',
  in_progress: 'info',
  processing: 'info',
  completed: 'success',
  failed: 'danger',
  cancelled: 'neutral',
};

function humanize(code: string): string {
  return code
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function communicationChannelLabel(channelCode: string, t: (key: TranslationKey) => string): string {
  const key = KNOWN_CHANNEL_KEYS[channelCode];
  return key ? t(key) : humanize(channelCode);
}

export function communicationStatusLabel(statusCode: string, t: (key: TranslationKey) => string): string {
  const key = KNOWN_STATUS_KEYS[statusCode];
  return key ? t(key) : humanize(statusCode);
}

export function communicationStatusTone(statusCode: string): 'neutral' | 'info' | 'success' | 'danger' {
  return STATUS_TONES[statusCode] ?? 'neutral';
}

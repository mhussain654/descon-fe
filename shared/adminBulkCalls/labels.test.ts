import type { TranslationKey } from '../i18n/translations';
import {
  bulkCallItemStatusLabel,
  bulkCallItemStatusTone,
  bulkCallOutcomeText,
  bulkCallOutcomeTone,
  bulkCallSkipReasonLabel,
  bulkCallStateLabel,
  bulkCallStateTone,
} from './labels';

const t = (key: TranslationKey) => `t:${key}`;

describe('bulk call labels', () => {
  it('labels and tones every call state', () => {
    expect(bulkCallStateLabel('not_called', t)).toBe('t:adminBulkCallStateNotCalled');
    expect(bulkCallStateLabel('queued', t)).toBe('t:adminBulkCallStateQueued');
    expect(bulkCallStateLabel('called', t)).toBe('t:adminBulkCallStateCalled');
    expect([bulkCallStateTone('not_called'), bulkCallStateTone('queued'), bulkCallStateTone('called')]).toEqual(['neutral', 'info', 'success']);
  });

  it('labels and tones every item status', () => {
    expect(bulkCallItemStatusLabel('placed', t)).toBe('t:adminBulkCallItemPlaced');
    expect(bulkCallItemStatusLabel('failed', t)).toBe('t:adminBulkCallItemFailed');
    expect((['queued', 'placed', 'skipped', 'failed'] as const).map(bulkCallItemStatusTone)).toEqual(['info', 'success', 'warning', 'danger']);
  });

  it('explains each skip reason, and shows an unknown one as it is', () => {
    expect(bulkCallSkipReasonLabel('stage_changed', t)).toBe('t:adminBulkCallSkipStageChanged');
    expect(bulkCallSkipReasonLabel('outside_calling_hours', t)).toBe('t:adminBulkCallSkipOutsideHours');
    expect(bulkCallSkipReasonLabel('something_new', t)).toBe('something_new');
  });

  it('writes the outcome with its reason, tolerating unknown values', () => {
    expect(bulkCallOutcomeText(undefined, undefined, t)).toBe('');
    expect(bulkCallOutcomeText('answered', undefined, t)).toBe('t:adminCandidateAiCallOutcomeAnswered');
    expect(bulkCallOutcomeText('not_answered', 'hangup', t)).toBe('t:adminCandidateAiCallOutcomeNotAnswered -- t:adminBulkCallReasonHangup');
    expect(bulkCallOutcomeText('callback_required', 'candidate_requested', t)).toContain('t:adminCandidateAiCallOutcomeReasonCandidateRequested');
    expect(bulkCallOutcomeText('mystery', 'odd', t)).toBe('mystery -- odd');
  });

  it('tones an outcome, neutral when unknown or missing', () => {
    expect(bulkCallOutcomeTone('answered')).toBe('success');
    expect(bulkCallOutcomeTone('callback_required')).toBe('warning');
    expect(bulkCallOutcomeTone('mystery')).toBe('neutral');
    expect(bulkCallOutcomeTone(undefined)).toBe('neutral');
  });
});

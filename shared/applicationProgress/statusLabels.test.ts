import {
  APPLICATION_SUBMISSION_STATE_KEYS,
  APPLICATION_SUBMISSION_STATE_TONES,
  BLOCKING_REQUIREMENT_REASON_KEYS,
} from './statusLabels';
import type { ApplicationSubmissionDisplayState, BlockingRequirementDisplayReason } from './types';
import { translations } from '../i18n/translations';

const ALL_STATES: ApplicationSubmissionDisplayState[] = [
  'no_assignment',
  'no_requirements',
  'incomplete',
  'ready',
  'submitted',
  'partially_verified',
  'verified',
  'changes_required',
  'unknown',
];

const ALL_REASONS: BlockingRequirementDisplayReason[] = ['missing', 'rejected', 'unknown'];

describe('APPLICATION_SUBMISSION_STATE_KEYS / TONES', () => {
  it.each(ALL_STATES)('has a translation key and tone for %s', (state) => {
    expect(APPLICATION_SUBMISSION_STATE_KEYS[state]).toEqual(expect.any(String));
    expect(APPLICATION_SUBMISSION_STATE_TONES[state]).toEqual(expect.any(String));
  });

  it('never maps a raw state to itself, so the UI cannot accidentally render an untranslated code', () => {
    for (const state of ALL_STATES) {
      expect(APPLICATION_SUBMISSION_STATE_KEYS[state]).not.toBe(state);
    }
  });

  it('maps every state to a real, translated key in both languages', () => {
    for (const key of Object.values(APPLICATION_SUBMISSION_STATE_KEYS)) {
      expect(translations.en).toHaveProperty(key);
      expect(translations.ur).toHaveProperty(key);
    }
  });
});

describe('BLOCKING_REQUIREMENT_REASON_KEYS', () => {
  it.each(ALL_REASONS)('has a translation key for %s', (reason) => {
    expect(BLOCKING_REQUIREMENT_REASON_KEYS[reason]).toEqual(expect.any(String));
  });

  it('maps every reason to a real, translated key in both languages', () => {
    for (const key of Object.values(BLOCKING_REQUIREMENT_REASON_KEYS)) {
      expect(translations.en).toHaveProperty(key);
      expect(translations.ur).toHaveProperty(key);
    }
  });
});

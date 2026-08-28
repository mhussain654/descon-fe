import { translations } from '../i18n/translations';
import {
  DOCUMENT_STATUS_KEYS,
  DOCUMENT_STATUS_TONES,
  FILTERABLE_REVIEW_STATES,
  REVIEW_STATE_KEYS,
  REVIEW_STATE_TONES,
} from './statusLabels';
import type { DocumentDisplayStatus, ReviewDisplayState } from './types';

function translated(key: string): string {
  return (translations.en as Record<string, string>)[key];
}

const REVIEW_STATES: ReviewDisplayState[] = [
  'pending_review',
  'partially_reviewed',
  'changes_required',
  'verified',
  'unknown',
];

const DOCUMENT_STATUSES: DocumentDisplayStatus[] = ['uploaded', 'pending_review', 'verified', 'rejected', 'unknown'];

describe('statusLabels', () => {
  it('has a translation key for every review state, including the unknown fallback', () => {
    REVIEW_STATES.forEach((state) => {
      expect(REVIEW_STATE_KEYS[state]).toBeTruthy();
    });
  });

  it('maps every review state, including unknown, to a real translated key', () => {
    REVIEW_STATES.forEach((state) => {
      const key = REVIEW_STATE_KEYS[state];
      expect(translations.en).toHaveProperty(key);
      expect(translations.ur).toHaveProperty(key);
    });
  });

  it('never resolves a review state to its own raw backend code as displayed text', () => {
    REVIEW_STATES.forEach((state) => {
      expect(translated(REVIEW_STATE_KEYS[state])).not.toBe(state);
    });
  });

  it('has a tone for every review state', () => {
    REVIEW_STATES.forEach((state) => {
      expect(REVIEW_STATE_TONES[state]).toBeTruthy();
    });
  });

  it('has a translation key and tone for every document status, including unknown', () => {
    DOCUMENT_STATUSES.forEach((status) => {
      expect(DOCUMENT_STATUS_KEYS[status]).toBeTruthy();
      expect(DOCUMENT_STATUS_TONES[status]).toBeTruthy();
    });
  });

  it('maps every document status, including unknown, to a real translated key', () => {
    DOCUMENT_STATUSES.forEach((status) => {
      const key = DOCUMENT_STATUS_KEYS[status];
      expect(translations.en).toHaveProperty(key);
      expect(translations.ur).toHaveProperty(key);
    });
  });

  it('excludes "unknown" from the filterable review states', () => {
    expect(FILTERABLE_REVIEW_STATES).not.toContain('unknown');
    expect(FILTERABLE_REVIEW_STATES).toEqual([
      'pending_review',
      'partially_reviewed',
      'changes_required',
      'verified',
    ]);
  });
});

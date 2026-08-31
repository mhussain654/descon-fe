import { QVC_ATTEMPT_STATUS_KEYS, QVC_OUTCOME_SELECT_VALUES } from './qvcOutcomeLabels';
import type { QvcAttemptStatus } from './types';

describe('QVC_ATTEMPT_STATUS_KEYS', () => {
  const ALL_STATUSES: QvcAttemptStatus[] = ['scheduled', 'approved', 're_medical', 'rejected', 'no_show'];

  it('has a non-empty translation key for every backend-returned status', () => {
    ALL_STATUSES.forEach((status) => {
      expect(QVC_ATTEMPT_STATUS_KEYS[status]).toBeTruthy();
    });
  });
});

describe('QVC_OUTCOME_SELECT_VALUES', () => {
  it('offers every recordable outcome plus no-show, never the scheduled placeholder', () => {
    expect(QVC_OUTCOME_SELECT_VALUES).toEqual(['approved', 're_medical', 'rejected', 'no_show']);
  });
});

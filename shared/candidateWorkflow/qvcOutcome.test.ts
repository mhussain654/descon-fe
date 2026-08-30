import { findLatestQvcOutcome } from './qvcOutcome';
import type { WorkflowHistoryItem } from './types';

function historyItem(overrides: Partial<WorkflowHistoryItem> = {}): WorkflowHistoryItem {
  return {
    fromStage: { code: 'qvc_appointment_booked', name: 'QVC Appointment Booked', position: 9 },
    toStage: { code: 'qvc_completed_outcome_received', name: 'QVC Completed / Outcome Received', position: 10 },
    occurredAt: '2026-08-10T00:00:00Z',
    reasonCode: null,
    details: { qvcOutcomeCode: 'approved', qvcOutcomeDate: '2026-08-10' },
    ...overrides,
  };
}

describe('findLatestQvcOutcome', () => {
  it('returns null when no history item transitions into the QVC-outcome stage', () => {
    expect(
      findLatestQvcOutcome([historyItem({ toStage: { code: 'registered', name: 'Registered', position: 1 }, details: null })])
    ).toBeNull();
  });

  it('returns the outcome and date from the matching transition', () => {
    expect(findLatestQvcOutcome([historyItem()])).toEqual({ code: 'approved', date: '2026-08-10' });
  });

  it('returns the most recent outcome when the candidate has been re-submitted for QVC more than once', () => {
    const items = [
      historyItem({ occurredAt: '2026-08-05T00:00:00Z', details: { qvcOutcomeCode: 're_medical_required', qvcOutcomeDate: '2026-08-05' } }),
      historyItem({ occurredAt: '2026-08-12T00:00:00Z', details: { qvcOutcomeCode: 'approved', qvcOutcomeDate: '2026-08-12' } }),
    ];

    expect(findLatestQvcOutcome(items)).toEqual({ code: 'approved', date: '2026-08-12' });
  });

  it('ignores a transition into the QVC-outcome stage that carries no outcome evidence', () => {
    expect(findLatestQvcOutcome([historyItem({ details: null })])).toBeNull();
  });
});

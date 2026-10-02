import { latestActionableUpdate, STAGE_UPDATE_DESCRIPTION_KEYS } from './latestUpdate';
import type { WorkflowHistoryItem } from './types';

function item(code: string, occurredAt: string): WorkflowHistoryItem {
  return {
    fromStage: null,
    toStage: { code, name: code, position: 1 },
    occurredAt,
    reasonCode: null,
    details: null,
  } as WorkflowHistoryItem;
}

describe('latestActionableUpdate', () => {
  it('returns the most recent actionable event, skipping waiting states', () => {
    const items = [
      item('documents_uploaded', '2026-09-01T10:00:00Z'),
      item('verified', '2026-09-03T10:00:00Z'),
      item('fee_pending', '2026-09-04T10:00:00Z'),
    ];

    expect(latestActionableUpdate(items)?.toStage.code).toBe('verified');
  });

  it('returns null when there is nothing actionable yet', () => {
    expect(latestActionableUpdate([item('documents_pending', '2026-09-01T10:00:00Z')])).toBeNull();
    expect(latestActionableUpdate([])).toBeNull();
  });

  it('has a description for every canonical stage', () => {
    expect(Object.keys(STAGE_UPDATE_DESCRIPTION_KEYS)).toHaveLength(15);
  });
});

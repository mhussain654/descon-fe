import { currentDashboardStage } from './currentDashboardStage';
import type { WorkflowTimelineStage } from './types';

function stage(overrides: Partial<WorkflowTimelineStage> = {}): WorkflowTimelineStage {
  return {
    code: 'registered',
    name: 'Registered',
    position: 1,
    status: 'pending',
    startedAt: null,
    completedAt: null,
    ...overrides,
  };
}

describe('currentDashboardStage', () => {
  it("returns the timeline's current stage, marked in-progress, when one exists", () => {
    const timeline = [
      stage({ code: 'registered', name: 'Registered', position: 1, status: 'completed' }),
      stage({ code: 'documents_pending', name: 'Documents Pending', position: 2, status: 'current' }),
      stage({ code: 'documents_uploaded', name: 'Documents Uploaded', position: 3, status: 'pending' }),
    ];

    expect(currentDashboardStage(timeline)).toEqual({ name: 'Documents Pending', inProgress: true });
  });

  it('falls back to the last completed stage (not in-progress) once every stage is completed', () => {
    const timeline = [
      stage({ code: 'registered', name: 'Registered', position: 1, status: 'completed' }),
      stage({ code: 'mobilized', name: 'Mobilized', position: 15, status: 'completed' }),
    ];

    expect(currentDashboardStage(timeline)).toEqual({ name: 'Mobilized', inProgress: false });
  });

  it('returns null for an empty timeline', () => {
    expect(currentDashboardStage([])).toBeNull();
  });
});

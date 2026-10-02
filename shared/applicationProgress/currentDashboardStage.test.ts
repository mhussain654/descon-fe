import { currentDashboardStage, upcomingDashboardStage } from './currentDashboardStage';
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

describe('upcomingDashboardStage', () => {
  const timeline = (statuses: Array<WorkflowTimelineStage['status']>) =>
    statuses.map((status, index) => stage({ code: `stage_${index + 1}`, name: `Stage ${index + 1}`, position: index + 1, status }));

  it('returns the first pending stage after the current one', () => {
    expect(upcomingDashboardStage(timeline(['completed', 'current', 'pending', 'pending']))?.name).toBe('Stage 3');
  });

  it('looks past the last completed stage when nothing is current', () => {
    expect(upcomingDashboardStage(timeline(['completed', 'completed', 'pending']))?.name).toBe('Stage 3');
  });

  it('returns null once every stage is complete', () => {
    expect(upcomingDashboardStage(timeline(['completed', 'completed']))).toBeNull();
  });
});

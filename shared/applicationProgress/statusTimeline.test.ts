import { buildStatusTimeline, currentDashboardStage } from './statusTimeline';
import type { ApplicationProgress, ApplicationSubmissionDisplayState } from './types';

function progress(submissionState: ApplicationSubmissionDisplayState): ApplicationProgress {
  return {
    candidateStatus: 'registered',
    currentWorkflowStage: null,
    documents: {
      requiredTotal: 2,
      missing: 0,
      uploaded: 0,
      pendingReview: 0,
      verified: 0,
      rejected: 0,
      submittedTotal: 0,
      completionPercentage: 0,
      canSubmit: false,
      submissionState,
      blockingRequirements: [],
    },
  };
}

function stage(timeline: ReturnType<typeof buildStatusTimeline>, labelKey: string) {
  const found = timeline.find((s) => s.labelKey === labelKey);
  if (!found) throw new Error(`missing stage ${labelKey}`);
  return found.status;
}

describe('buildStatusTimeline', () => {
  it('always returns all 14 prototype stages in the approved order', () => {
    const timeline = buildStatusTimeline(progress('no_assignment'));
    expect(timeline.map((s) => s.labelKey)).toEqual([
      'registered',
      'documentsPending',
      'documentsUploaded',
      'documentsVerified',
      'feePending',
      'feePaid',
      'sharedWithBU',
      'qvcBooked',
      'qvcOutcome',
      'visaIssued',
      'protectionCompleted',
      'readyToFly',
      'flightDetailsUploaded',
      'mobilized',
    ]);
  });

  it('registered is always completed', () => {
    expect(stage(buildStatusTimeline(progress('no_assignment')), 'registered')).toBe('completed');
    expect(stage(buildStatusTimeline(progress('verified')), 'registered')).toBe('completed');
  });

  it('marks documentsPending as current while there is no assignment or no requirements yet', () => {
    expect(stage(buildStatusTimeline(progress('no_assignment')), 'documentsPending')).toBe('current');
    expect(stage(buildStatusTimeline(progress('no_requirements')), 'documentsPending')).toBe('current');
  });

  it('marks documentsUploaded as current once requirements exist but nothing has been submitted', () => {
    const timeline = buildStatusTimeline(progress('incomplete'));
    expect(stage(timeline, 'documentsPending')).toBe('completed');
    expect(stage(timeline, 'documentsUploaded')).toBe('current');
    expect(stage(timeline, 'documentsVerified')).toBe('pending');
  });

  it('marks documentsUploaded completed and documentsVerified current once submitted', () => {
    const timeline = buildStatusTimeline(progress('submitted'));
    expect(stage(timeline, 'documentsUploaded')).toBe('completed');
    expect(stage(timeline, 'documentsVerified')).toBe('current');
  });

  it('marks documentsVerified completed only when the backend reports the submission as verified', () => {
    const timeline = buildStatusTimeline(progress('verified'));
    expect(stage(timeline, 'documentsUploaded')).toBe('completed');
    expect(stage(timeline, 'documentsVerified')).toBe('completed');
  });

  it('never marks any of the 10 downstream stages as completed or current -- no real signal exists for them', () => {
    for (const state of ['no_assignment', 'incomplete', 'ready', 'submitted', 'partially_verified', 'verified', 'changes_required'] as const) {
      const timeline = buildStatusTimeline(progress(state));
      const downstream = timeline.slice(4);
      expect(downstream.every((s) => s.status === 'pending')).toBe(true);
    }
  });
});

describe('currentDashboardStage', () => {
  it("returns the timeline's current stage, marked in-progress, when one exists", () => {
    expect(currentDashboardStage(buildStatusTimeline(progress('no_assignment')))).toEqual({
      labelKey: 'documentsPending',
      inProgress: true,
    });
    expect(currentDashboardStage(buildStatusTimeline(progress('incomplete')))).toEqual({
      labelKey: 'documentsUploaded',
      inProgress: true,
    });
    expect(currentDashboardStage(buildStatusTimeline(progress('submitted')))).toEqual({
      labelKey: 'documentsVerified',
      inProgress: true,
    });
  });

  it('falls back to the last completed stage (not in-progress) once fully verified, rather than regressing to registered', () => {
    expect(currentDashboardStage(buildStatusTimeline(progress('verified')))).toEqual({
      labelKey: 'documentsVerified',
      inProgress: false,
    });
  });
});

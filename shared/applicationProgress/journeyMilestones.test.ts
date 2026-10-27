import { journeyProgress, WAITING_STAGE_CODES } from './journeyMilestones';
import type { WorkflowTimelineStage } from './types';

function stage(code: string, position: number, status: WorkflowTimelineStage['status'], name = code): WorkflowTimelineStage {
  return { code, name, position, actionType: 'none', required: true, status, startedAt: null, completedAt: null };
}

const timeline = [
  stage('registered', 1, 'completed'),
  stage('documents_pending', 2, 'completed'),
  stage('documents_uploaded', 3, 'completed'),
  stage('under_verification', 4, 'current'),
  stage('verified', 5, 'pending'),
  stage('medical_pending', 6, 'pending'),
  stage('medical_completed', 7, 'pending'),
  stage('fee_pending', 8, 'pending'),
  stage('fee_paid', 9, 'pending'),
];

describe('journeyProgress', () => {
  it('lists only the milestones, numbered without gaps', () => {
    const { milestones } = journeyProgress(timeline);
    expect(milestones.map((s) => [s.code, s.position])).toEqual([
      ['registered', 1],
      ['documents_uploaded', 2],
      ['verified', 3],
      ['medical_completed', 4],
      ['fee_paid', 5],
    ]);
  });

  it('counts progress over the milestones only', () => {
    expect(journeyProgress(timeline)).toMatchObject({ completedCount: 2, totalCount: 5, percentage: 40 });
  });

  it('is 100% when every milestone is completed, and 0 for an empty timeline', () => {
    expect(journeyProgress(timeline.map((s) => ({ ...s, status: 'completed' as const }))).percentage).toBe(100);
    expect(journeyProgress([])).toMatchObject({ milestones: [], totalCount: 0, percentage: 0 });
  });

  it('keeps the e-number, fee and visa results as milestones', () => {
    ['e_number_received', 'fee_paid', 'visa_issued_or_rejected', 'medical_completed', 'gamca_medical_completed'].forEach((code) =>
      expect(WAITING_STAGE_CODES.has(code)).toBe(false)
    );
  });
});

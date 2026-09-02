import { paymentStatusFromTimeline } from './paymentStatusFromTimeline';
import type { WorkflowTimelineStage } from './types';

function stage(code: string, status: WorkflowTimelineStage['status']): WorkflowTimelineStage {
  return { code, name: code, position: 1, status };
}

describe('paymentStatusFromTimeline', () => {
  it('reports paid when fee_paid is the current stage', () => {
    const timeline = [stage('fee_pending', 'completed'), stage('fee_paid', 'current')];
    expect(paymentStatusFromTimeline(timeline)).toBe('paid');
  });

  it('reports paid when fee_paid is completed (the candidate has advanced further)', () => {
    const timeline = [stage('fee_paid', 'completed'), stage('documents_shared_with_qatar_bu', 'current')];
    expect(paymentStatusFromTimeline(timeline)).toBe('paid');
  });

  it('reports pending when fee_pending is the current stage', () => {
    const timeline = [stage('verified', 'completed'), stage('fee_pending', 'current'), stage('fee_paid', 'pending')];
    expect(paymentStatusFromTimeline(timeline)).toBe('pending');
  });

  it('reports not_reached before the candidate has reached fee_pending', () => {
    const timeline = [stage('registered', 'completed'), stage('documents_pending', 'current'), stage('fee_pending', 'pending')];
    expect(paymentStatusFromTimeline(timeline)).toBe('not_reached');
  });

  it('reports not_reached for an empty timeline', () => {
    expect(paymentStatusFromTimeline([])).toBe('not_reached');
  });
});

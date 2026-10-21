import {
  adminAiCallOutcomeLabel,
  adminAiCallOutcomeReasonLabel,
  adminAiCallOutcomeTone,
  adminAiCallStatusLabel,
  adminAiCallStatusTone,
  adminAiCallTriggerLabel,
  adminAiCallVerificationStatusLabel,
} from './callLabels';
import type { AdminAiCallOutcomeReason } from './types';

const t = (key: string) => `t:${key}`;

describe('adminAiCallTriggerLabel', () => {
  it('translates every way a call can be started to its own key', () => {
    expect(adminAiCallTriggerLabel('manual', t)).toBe('t:adminCandidateAiCallTriggerManual');
    expect(adminAiCallTriggerLabel('automatic', t)).toBe('t:adminCandidateAiCallTriggerAutomatic');
    expect(adminAiCallTriggerLabel('bulk', t)).toBe('t:adminCandidateAiCallTriggerBulk');
  });
});

describe('adminAiCallOutcomeLabel/Tone', () => {
  it('translates and tones every outcome', () => {
    expect(adminAiCallOutcomeLabel('answered', t)).toBe('t:adminCandidateAiCallOutcomeAnswered');
    expect(adminAiCallOutcomeTone('answered')).toBe('success');
    expect(adminAiCallOutcomeTone('callback_required')).toBe('warning');
    expect(adminAiCallOutcomeTone('not_answered')).toBe('neutral');
  });
});

describe('adminAiCallOutcomeReasonLabel', () => {
  it('translates every outcome_reason to its own dedicated key', () => {
    const reasons: AdminAiCallOutcomeReason[] = [
      'resolved',
      'unresolved',
      'candidate_requested',
      'agent_escalation',
      'busy',
      'no_answer',
      'voicemail',
      'provider_failure',
      'needs_manual_review',
    ];
    const labels = new Set(reasons.map((reason) => adminAiCallOutcomeReasonLabel(reason, t)));

    expect(labels.size).toBe(reasons.length);
    expect(adminAiCallOutcomeReasonLabel('candidate_requested', t)).toBe('t:adminCandidateAiCallOutcomeReasonCandidateRequested');
  });
});

describe('adminAiCallVerificationStatusLabel', () => {
  it('translates every verification_status', () => {
    expect(adminAiCallVerificationStatusLabel('not_applicable', t)).toBe('t:adminCandidateAiCallVerificationNotApplicable');
    expect(adminAiCallVerificationStatusLabel('verified', t)).toBe('t:adminCandidateAiCallVerificationVerified');
  });
});

describe('adminAiCallStatusLabel/Tone (re-exported from communicationLabels)', () => {
  it('translates a known status and tones it', () => {
    expect(adminAiCallStatusLabel('completed', t)).toBe('t:adminCommunicationStatusCompleted');
    expect(adminAiCallStatusTone('completed')).toBe('success');
    expect(adminAiCallStatusTone('failed')).toBe('danger');
  });
});

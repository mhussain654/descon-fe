import {
  adminAiCallConfirmDescription,
  adminAiCallOutcomeLabel,
  adminAiCallOutcomeTone,
  adminAiCallReasonLabel,
  adminAiCallStatusLabel,
  adminAiCallStatusTone,
  adminAiCallVerificationStatusLabel,
} from './callLabels';

const t = (key: string) => `t:${key}`;

describe('adminAiCallReasonLabel', () => {
  it('translates every call_reason', () => {
    expect(adminAiCallReasonLabel('missing_documents', t)).toBe('t:adminCandidateAiCallReasonMissingDocuments');
    expect(adminAiCallReasonLabel('protection_appearance_reminder', t)).toBe('t:adminCandidateAiCallReasonProtectionAppearanceReminder');
    expect(adminAiCallReasonLabel('urgent_compliance_action', t)).toBe('t:adminCandidateAiCallReasonUrgentComplianceAction');
    expect(adminAiCallReasonLabel('flight_information', t)).toBe('t:adminCandidateAiCallReasonFlightInformation');
  });
});

describe('adminAiCallConfirmDescription', () => {
  it('gives each call_reason its own dedicated confirm description', () => {
    const descriptions = new Set(
      (['missing_documents', 'protection_appearance_reminder', 'urgent_compliance_action', 'flight_information'] as const).map((reason) =>
        adminAiCallConfirmDescription(reason, t)
      )
    );
    expect(descriptions.size).toBe(4);
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

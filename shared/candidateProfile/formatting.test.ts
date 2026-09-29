import { candidateStatusLabel, humanizeStatusCode } from './formatting';

describe('humanizeStatusCode', () => {
  it('replaces underscores with spaces and capitalizes each word', () => {
    expect(humanizeStatusCode('documents_pending')).toBe('Documents Pending');
    expect(humanizeStatusCode('registered')).toBe('Registered');
  });

  it('handles an already-clean single word', () => {
    expect(humanizeStatusCode('active')).toBe('Active');
  });
});

describe('candidateStatusLabel', () => {
  it('uses the localized workflow-stage name when the codes match', () => {
    const label = candidateStatusLabel({
      candidateStatus: 'documents_pending',
      currentWorkflowStage: { code: 'documents_pending', name: 'دستاویزات زیر التوا' },
    });

    expect(label).toBe('دستاویزات زیر التوا');
  });

  it('falls back to a plain humanization when there is no workflow stage yet', () => {
    const label = candidateStatusLabel({ candidateStatus: 'registered', currentWorkflowStage: null });

    expect(label).toBe('Registered');
  });

  it('falls back to a plain humanization if the codes ever disagree, rather than trusting a mismatched name', () => {
    const label = candidateStatusLabel({
      candidateStatus: 'documents_pending',
      currentWorkflowStage: { code: 'verified', name: 'Verified' },
    });

    expect(label).toBe('Documents Pending');
  });
});

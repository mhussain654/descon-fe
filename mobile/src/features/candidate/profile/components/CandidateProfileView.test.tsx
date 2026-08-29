import { fireEvent, render, screen } from '@testing-library/react-native';
import { translate } from '../../../../../../shared/i18n/translate';
import { CandidateProfileView } from './CandidateProfileView';

function tFor(language: 'en' | 'ur') {
  return (key: Parameters<typeof translate>[1]) => translate(language, key);
}

function profile(overrides = {}) {
  return {
    id: 'candidate-public-id-1',
    fullName: 'Ahmed Ali',
    maskedCnic: '42101-*******-1',
    referenceNumber: 'DES-001001',
    preferredLocale: 'en' as const,
    candidateStatus: 'documents_pending',
    currentWorkflowStage: { code: 'documents_pending', name: 'Documents pending' },
    active: true,
    ...overrides,
  };
}

describe('CandidateProfileView', () => {
  it('shows a loading state', () => {
    render(
      <CandidateProfileView
        isLoading
        error={null}
        profile={undefined}
        t={tFor('en')}
        onRetry={() => {}}
        onReturnToSignIn={() => {}}
      />
    );

    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('renders only the approved safe fields, never the raw CNIC', () => {
    render(
      <CandidateProfileView
        isLoading={false}
        error={null}
        profile={profile()}
        t={tFor('en')}
        onRetry={() => {}}
        onReturnToSignIn={() => {}}
      />
    );

    expect(screen.getByText('Ahmed Ali')).toBeTruthy();
    expect(screen.getByText('42101-*******-1')).toBeTruthy();
    expect(screen.getAllByText('DES-001001').length).toBeGreaterThan(0);
    expect(screen.getByText('Documents pending')).toBeTruthy();
    expect(screen.queryByText('42101-1234567-1')).toBeNull();
  });

  it('humanizes the status code -- never a raw underscored backend value', () => {
    render(
      <CandidateProfileView
        isLoading={false}
        error={null}
        profile={profile({ candidateStatus: 'documents_pending' })}
        t={tFor('en')}
        onRetry={() => {}}
        onReturnToSignIn={() => {}}
      />
    );

    expect(screen.getByText('Documents Pending')).toBeTruthy();
    expect(screen.queryByText('documents_pending')).toBeNull();
  });

  it('shows the empty-assignment label when there is no current workflow stage', () => {
    render(
      <CandidateProfileView
        isLoading={false}
        error={null}
        profile={profile({ currentWorkflowStage: null })}
        t={tFor('en')}
        onRetry={() => {}}
        onReturnToSignIn={() => {}}
      />
    );

    expect(screen.getByText('Not assigned yet')).toBeTruthy();
  });

  it('shows the empty-assignment label for both reference number and workflow stage when the candidate has no assignment yet', () => {
    render(
      <CandidateProfileView
        isLoading={false}
        error={null}
        profile={profile({ referenceNumber: null, currentWorkflowStage: null })}
        t={tFor('en')}
        onRetry={() => {}}
        onReturnToSignIn={() => {}}
      />
    );

    // One for the header line under the candidate's name, one for the
    // reference-number row, one for the workflow-stage row.
    expect(screen.getAllByText('Not assigned yet')).toHaveLength(3);
    expect(screen.queryByText('DES-001001')).toBeNull();
  });

  it('shows a session-expired state and calls onReturnToSignIn from its action', () => {
    const onReturnToSignIn = jest.fn();
    render(
      <CandidateProfileView
        isLoading={false}
        error={{ code: 'SESSION_EXPIRED' }}
        profile={undefined}
        t={tFor('en')}
        onRetry={() => {}}
        onReturnToSignIn={onReturnToSignIn}
      />
    );

    fireEvent.press(screen.getByText('Sign in again'));
    expect(onReturnToSignIn).toHaveBeenCalled();
  });

  it('shows a distinct inactive-account state, not the generic session-expired one', () => {
    render(
      <CandidateProfileView
        isLoading={false}
        error={{ code: 'INACTIVE_ACCOUNT' }}
        profile={undefined}
        t={tFor('en')}
        onRetry={() => {}}
        onReturnToSignIn={() => {}}
      />
    );

    expect(screen.getByText('Account inactive')).toBeTruthy();
    expect(screen.queryByText('Session expired')).toBeNull();
  });

  it('shows an offline state with a retry action', () => {
    const onRetry = jest.fn();
    render(
      <CandidateProfileView
        isLoading={false}
        error={{ code: 'OFFLINE' }}
        profile={undefined}
        t={tFor('en')}
        onRetry={onRetry}
        onReturnToSignIn={() => {}}
      />
    );

    fireEvent.press(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('shows the green verified indicator only when the backend submissionState is verified, plus document counts', () => {
    render(
      <CandidateProfileView
        isLoading={false}
        error={null}
        profile={profile()}
        documents={{
          requiredTotal: 3,
          missing: 0,
          uploaded: 0,
          pendingReview: 0,
          verified: 3,
          rejected: 0,
          submittedTotal: 3,
          completionPercentage: 100,
          canSubmit: false,
          submissionState: 'verified',
          blockingRequirements: [],
        }}
        t={tFor('en')}
        onRetry={() => {}}
        onReturnToSignIn={() => {}}
      />
    );

    expect(screen.getByText('Document verification')).toBeTruthy();
    expect(screen.getAllByText('Verified').length).toBeGreaterThan(0);
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('shows the submission state (not "Verified") while documents are only partially verified', () => {
    render(
      <CandidateProfileView
        isLoading={false}
        error={null}
        profile={profile()}
        documents={{
          requiredTotal: 3,
          missing: 0,
          uploaded: 0,
          pendingReview: 2,
          verified: 1,
          rejected: 0,
          submittedTotal: 3,
          completionPercentage: 100,
          canSubmit: false,
          submissionState: 'partially_verified',
          blockingRequirements: [],
        }}
        t={tFor('en')}
        onRetry={() => {}}
        onReturnToSignIn={() => {}}
      />
    );

    expect(screen.getByText('Partially verified')).toBeTruthy();
  });

  it('omits the document-verification section until progress data is available', () => {
    render(
      <CandidateProfileView
        isLoading={false}
        error={null}
        profile={profile()}
        t={tFor('en')}
        onRetry={() => {}}
        onReturnToSignIn={() => {}}
      />
    );

    expect(screen.queryByText('Document verification')).toBeNull();
  });

  it('renders in Urdu when given the Urdu translator', () => {
    render(
      <CandidateProfileView
        isLoading={false}
        error={null}
        profile={profile()}
        t={tFor('ur')}
        onRetry={() => {}}
        onReturnToSignIn={() => {}}
      />
    );

    expect(screen.getByText('شناختی کارڈ')).toBeTruthy();
    expect(screen.getByText('ذاتی معلومات')).toBeTruthy();
  });
});

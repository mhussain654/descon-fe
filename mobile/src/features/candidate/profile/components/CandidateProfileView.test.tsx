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

    expect(screen.getByText('Not yet assigned')).toBeTruthy();
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

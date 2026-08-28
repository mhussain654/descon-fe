import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../../../../contexts/AuthContext';
import { LanguageProvider } from '../../../../contexts/LanguageContext';
import { Toaster } from '../../../../design-system';
import { applicationProgressClient } from '../../../../lib/application-progress-client';
import type { ApplicationProgress, ApplicationProgressDocuments, DocumentSubmissionResult } from '../../../../lib/application-progress-client';
import { destroyQueryClientMutations } from '../../../../testSupport/destroyQueryClientMutations';
import { ApplicationProgressSummary } from './ApplicationProgressSummary';

const TEST_SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => () => {}),
}));

jest.mock('../../../../lib/application-progress-client', () => ({
  applicationProgressClient: { getProgress: jest.fn(), submitDocuments: jest.fn() },
}));

const getProgress = jest.mocked(applicationProgressClient.getProgress);
const submitDocuments = jest.mocked(applicationProgressClient.submitDocuments);

function documentsSummary(overrides: Partial<ApplicationProgressDocuments> = {}): ApplicationProgressDocuments {
  return {
    requiredTotal: 2,
    missing: 0,
    uploaded: 0,
    pendingReview: 0,
    verified: 0,
    rejected: 0,
    submittedTotal: 0,
    completionPercentage: 0,
    canSubmit: false,
    submissionState: 'incomplete',
    blockingRequirements: [],
    ...overrides,
  };
}

function progress(overrides: Partial<ApplicationProgress> = {}): ApplicationProgress {
  return {
    candidateStatus: 'registered',
    currentWorkflowStage: { code: 'registered', name: 'Registered' },
    documents: documentsSummary(),
    ...overrides,
  };
}

function submissionResult(overrides: Partial<DocumentSubmissionResult> = {}): DocumentSubmissionResult {
  return {
    message: 'Documents submitted for review.',
    submissionId: '0f5b8c9a-4f88-440d-94eb-cf70f780ff95',
    submittedAt: '2026-08-26T12:00:00Z',
    submissionState: 'submitted',
    documents: { requiredTotal: 2, pendingReview: 2, canSubmit: false },
    ...overrides,
  };
}

function LoggedInHarness({ children }: { children: React.ReactNode }) {
  const { login, status } = useAuth();
  const hasLoggedInRef = useRef(false);
  useEffect(() => {
    if (status === 'restoring' || hasLoggedInRef.current) return;
    hasLoggedInRef.current = true;
    login({
      accessToken: 'candidate-access-token',
      refreshToken: 'refresh',
      candidateId: 'candidate-public-id-1',
      candidateName: 'Ahmed Ali',
      preferredLocale: 'en',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
  }, [status, login]);

  if (status !== 'authenticated') return null;
  return <>{children}</>;
}

// See destroyQueryClientMutations.ts for why this is needed even with
// `gcTime: 0` set below.
let activeQueryClient: QueryClient | undefined;

function renderSummary({ onReturnToSignIn = jest.fn() } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } } });
  activeQueryClient = queryClient;
  return render(
    <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <AuthProvider>
            <LoggedInHarness>
              <ApplicationProgressSummary onReturnToSignIn={onReturnToSignIn} />
            </LoggedInHarness>
            <Toaster />
          </AuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

describe('ApplicationProgressSummary', () => {
  afterEach(async () => {
    getProgress.mockReset();
    submitDocuments.mockReset();
    // See destroyQueryClientMutations.ts -- `.clear()` alone does not clear
    // each mutation's pending GC timeout.
    if (activeQueryClient) destroyQueryClientMutations(activeQueryClient);
    activeQueryClient?.clear();
    activeQueryClient = undefined;
    // Guaranteed regardless of whether the Urdu test's own assertions
    // passed -- matches LanguageContext.test.jsx's cleanup pattern.
    await AsyncStorage.clear();
  });

  it('shows a loading state before progress resolves', async () => {
    getProgress.mockReturnValue(new Promise(() => {}));
    renderSummary();
    expect(await screen.findByText('Loading…')).toBeTruthy();
  });

  it('shows an informative empty state for no_assignment, not an error', async () => {
    getProgress.mockResolvedValue(
      progress({ currentWorkflowStage: null, documents: documentsSummary({ requiredTotal: 0, submissionState: 'no_assignment' }) })
    );
    renderSummary();
    expect(await screen.findByText('No assignment yet')).toBeTruthy();
  });

  it('shows an informative empty state for no_requirements, not an error', async () => {
    getProgress.mockResolvedValue(progress({ documents: documentsSummary({ requiredTotal: 0, submissionState: 'no_requirements' }) }));
    renderSummary();
    expect(await screen.findByText('No documents required')).toBeTruthy();
  });

  it('shows blocking documents and no enabled submit action for incomplete', async () => {
    getProgress.mockResolvedValue(
      progress({
        documents: documentsSummary({
          submissionState: 'incomplete',
          canSubmit: false,
          blockingRequirements: [{ requirementCode: 'passport', name: 'Passport', reason: 'missing' }],
        }),
      })
    );
    renderSummary();

    expect(await screen.findByText('Documents incomplete')).toBeTruthy();
    expect(screen.getByText('Passport')).toBeTruthy();
    expect(screen.getByText('Not uploaded yet')).toBeTruthy();
    expect(screen.queryByText('Submit for review')).toBeNull();
  });

  it('shows an enabled submit action only when can_submit is true (ready)', async () => {
    getProgress.mockResolvedValue(progress({ documents: documentsSummary({ submissionState: 'ready', canSubmit: true, completionPercentage: 100 }) }));
    renderSummary();

    expect(await screen.findByText('Ready to submit')).toBeTruthy();
    expect(screen.getByText('Submit for review')).toBeTruthy();
  });

  it('shows a replace reason for changes_required, and no enabled submit action', async () => {
    getProgress.mockResolvedValue(
      progress({
        documents: documentsSummary({
          submissionState: 'changes_required',
          canSubmit: false,
          blockingRequirements: [{ requirementCode: 'passport', name: 'Passport', reason: 'rejected' }],
        }),
      })
    );
    renderSummary();

    expect(await screen.findByText('Changes required')).toBeTruthy();
    expect(screen.getByText('Rejected — replace this document')).toBeTruthy();
    expect(screen.queryByText('Submit for review')).toBeNull();
  });

  it.each(['submitted', 'partially_verified', 'verified'] as const)('shows no enabled submit action for %s', async (submissionState) => {
    getProgress.mockResolvedValue(progress({ documents: documentsSummary({ submissionState, canSubmit: false, completionPercentage: 100 }) }));
    renderSummary();

    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull());
    expect(screen.queryByText('Submit for review')).toBeNull();
  });

  it('falls back an unrecognized submission state to a neutral, non-crashing display', async () => {
    getProgress.mockResolvedValue(progress({ documents: documentsSummary({ submissionState: 'unknown', canSubmit: false }) }));
    renderSummary();
    expect(await screen.findByText('Status unavailable')).toBeTruthy();
  });

  describe('submission confirmation', () => {
    async function readyState() {
      getProgress.mockResolvedValue(progress({ documents: documentsSummary({ submissionState: 'ready', canSubmit: true }) }));
      renderSummary();
      fireEvent.press(await screen.findByText('Submit for review'));
    }

    it('opens a confirmation dialog before submitting', async () => {
      await readyState();
      expect(await screen.findByText('Submit documents for review?')).toBeTruthy();
      expect(submitDocuments).not.toHaveBeenCalled();
    });

    it('submits on confirmation and clears the dialog', async () => {
      submitDocuments.mockResolvedValue(submissionResult());
      await readyState();
      await screen.findByText('Submit documents for review?');

      getProgress.mockResolvedValue(progress({ documents: documentsSummary({ submissionState: 'submitted', canSubmit: false, pendingReview: 2 }) }));
      fireEvent.press(screen.getByText('Submit'));

      await waitFor(() => expect(screen.queryByText('Submit documents for review?')).not.toBeOnTheScreen());
      expect(await screen.findByText('Submitted for review')).toBeTruthy();
    });

    it('prevents duplicate submission while a submission is already in flight', async () => {
      submitDocuments.mockReturnValue(new Promise(() => {}));
      await readyState();
      await screen.findByText('Submit documents for review?');

      const confirmButton = screen.getByText('Submit');
      fireEvent.press(confirmButton);
      await waitFor(() => expect(submitDocuments).toHaveBeenCalledTimes(1));
      fireEvent.press(confirmButton);
      fireEvent.press(confirmButton);

      expect(submitDocuments).toHaveBeenCalledTimes(1);
    });

    it('retries a failed submission with the same idempotency key after a server error', async () => {
      submitDocuments.mockRejectedValueOnce({ code: 'SERVER_ERROR' }).mockResolvedValueOnce(submissionResult());
      await readyState();
      await screen.findByText('Submit documents for review?');

      fireEvent.press(screen.getByText('Submit'));
      await screen.findByText('Something went wrong.');

      fireEvent.press(screen.getByText('Submit'));
      await waitFor(() => expect(screen.queryByText('Submit documents for review?')).not.toBeOnTheScreen());

      const [firstCall, secondCall] = submitDocuments.mock.calls;
      expect(firstCall[0].idempotencyKey).toBe(secondCall[0].idempotencyKey);
    });

    it('generates a fresh idempotency key after an idempotency conflict', async () => {
      submitDocuments.mockRejectedValueOnce({ code: 'CONFLICT' }).mockResolvedValueOnce(submissionResult());
      await readyState();
      await screen.findByText('Submit documents for review?');

      fireEvent.press(screen.getByText('Submit'));
      await screen.findByText('This submission could not be confirmed. Try submitting again.');

      fireEvent.press(screen.getByText('Submit'));
      await waitFor(() => expect(screen.queryByText('Submit documents for review?')).not.toBeOnTheScreen());

      const [firstCall, secondCall] = submitDocuments.mock.calls;
      expect(firstCall[0].idempotencyKey).not.toBe(secondCall[0].idempotencyKey);
    });

    it('closes the dialog and refreshes progress on documents_incomplete rather than an automatic retry', async () => {
      submitDocuments.mockRejectedValue({
        code: 'DOCUMENTS_INCOMPLETE',
        blockingRequirements: [{ requirementCode: 'cnic_front', name: 'CNIC (Front)', reason: 'missing' }],
      });
      await readyState();
      await screen.findByText('Submit documents for review?');

      getProgress.mockResolvedValue(
        progress({
          documents: documentsSummary({
            submissionState: 'incomplete',
            canSubmit: false,
            blockingRequirements: [{ requirementCode: 'cnic_front', name: 'CNIC (Front)', reason: 'missing' }],
          }),
        })
      );
      fireEvent.press(screen.getByText('Submit'));

      await waitFor(() => expect(screen.queryByText('Submit documents for review?')).not.toBeOnTheScreen());
      expect(await screen.findByText('Documents incomplete')).toBeTruthy();
      expect(screen.getByText('CNIC (Front)')).toBeTruthy();
    });

    it('ends the session and returns to sign-in on a 401 during submission', async () => {
      const onReturnToSignIn = jest.fn();
      submitDocuments.mockRejectedValue({ code: 'SESSION_EXPIRED' });
      getProgress.mockResolvedValue(progress({ documents: documentsSummary({ submissionState: 'ready', canSubmit: true }) }));
      renderSummary({ onReturnToSignIn });
      fireEvent.press(await screen.findByText('Submit for review'));
      await screen.findByText('Submit documents for review?');

      fireEvent.press(screen.getByText('Submit'));
      await waitFor(() => expect(onReturnToSignIn).toHaveBeenCalled());
    });

    it('ends the session and shows the inactive-account flow on inactive_account during submission', async () => {
      const onReturnToSignIn = jest.fn();
      submitDocuments.mockRejectedValue({ code: 'INACTIVE_ACCOUNT' });
      getProgress.mockResolvedValue(progress({ documents: documentsSummary({ submissionState: 'ready', canSubmit: true }) }));
      renderSummary({ onReturnToSignIn });
      fireEvent.press(await screen.findByText('Submit for review'));
      await screen.findByText('Submit documents for review?');

      fireEvent.press(screen.getByText('Submit'));
      await waitFor(() => expect(onReturnToSignIn).toHaveBeenCalled());
    });
  });

  it('never sends a candidate id, assignment id, document id or requirement code when submitting', async () => {
    submitDocuments.mockResolvedValue(submissionResult());
    getProgress.mockResolvedValue(progress({ documents: documentsSummary({ submissionState: 'ready', canSubmit: true }) }));
    renderSummary();

    fireEvent.press(await screen.findByText('Submit for review'));
    fireEvent.press(await screen.findByText('Submit'));

    await waitFor(() => expect(submitDocuments).toHaveBeenCalledTimes(1));
    const call = submitDocuments.mock.calls[0][0];
    expect(Object.keys(call).sort()).toEqual(['accessToken', 'idempotencyKey']);
  });

  it('renders in Urdu when the persisted language is Urdu', async () => {
    await AsyncStorage.setItem('descon.language', 'ur');
    getProgress.mockResolvedValue(
      progress({
        currentWorkflowStage: { code: 'registered', name: 'رجسٹرڈ' },
        documents: documentsSummary({ submissionState: 'ready', canSubmit: true, completionPercentage: 100 }),
      })
    );

    renderSummary();

    expect(await screen.findByText('جمع کرانے کے لیے تیار')).toBeTruthy();
    expect(screen.getByText('رجسٹرڈ')).toBeTruthy();
    expect(screen.getByText('جائزے کے لیے جمع کرائیں')).toBeTruthy();
  });
});

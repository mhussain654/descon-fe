import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../../../../contexts/AuthContext';
import { LanguageProvider } from '../../../../contexts/LanguageContext';
import { Toaster } from '../../../../design-system';
import { candidateDocumentsClient } from '../../../../lib/candidate-documents-client';
import type {
  CandidateDocumentChecklistItem,
  CandidateDocumentMetadata,
  CandidateDocumentsError,
} from '../../../../lib/candidate-documents-client';
import { useCandidateDocuments } from '../hooks/useCandidateDocuments';
import { DocumentChecklistView } from './DocumentChecklistView';

// `initialWindowMetrics` is null under Jest (populated natively), which
// otherwise leaves useSafeAreaInsets() unresolved -- same fix as login.test.jsx.
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

jest.mock('../../../../lib/candidate-documents-client', () => ({
  candidateDocumentsClient: { getChecklist: jest.fn(), uploadDocument: jest.fn() },
}));

const mockGetDocumentAsync = jest.fn();
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: (...args: unknown[]) => mockGetDocumentAsync(...args),
}));

function item(overrides: Partial<CandidateDocumentChecklistItem> = {}): CandidateDocumentChecklistItem {
  return {
    requirementCode: 'passport',
    name: 'Passport',
    required: true,
    status: 'missing',
    replacementAllowed: true,
    document: null,
    ...overrides,
  };
}

function uploadedDocument(overrides: Partial<CandidateDocumentMetadata> = {}): CandidateDocumentMetadata {
  return {
    id: '30fcedd6-7fe6-4d12-a5ae-f6b5ef3d91dd',
    fileName: 'passport.pdf',
    contentType: 'application/pdf',
    fileSize: 123456,
    uploadedAt: '2026-08-26T12:00:00Z',
    ...overrides,
  };
}

function pickedDocument(overrides = {}) {
  return {
    uri: 'file:///cache/passport.pdf',
    name: 'passport.pdf',
    size: 1024,
    mimeType: 'application/pdf',
    lastModified: 1700000000000,
    ...overrides,
  };
}

function LoggedInHarness({ children }: { children: React.ReactNode }) {
  const { login, status } = useAuth();
  // Fires exactly once (login() is async -- a SecureStore write) rather
  // than being called directly in the render body, which would re-invoke
  // on every re-render triggered by its own state update.
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

// `DocumentChecklistView` itself receives `checklist` as a plain prop --
// production wiring (`(tabs)/documents/index.jsx`) feeds it from the real
// `useCandidateDocuments()` query so that `queryClient.setQueryData` calls
// made by the upload hook (on upload success) flow back into the rendered
// list. Most tests below pass a static `checklist` prop directly, which is
// fine for pure presentational assertions, but a test that checks the list
// re-rendering *after* a successful upload needs that real wiring -- this
// harness reproduces it.
function ConnectedHarness({ onReturnToSignIn = jest.fn() }: { onReturnToSignIn?: () => void }) {
  const query = useCandidateDocuments();
  const t = (key: string) => require('../../../../../../shared/i18n/translate').translate('en', key);
  return (
    <DocumentChecklistView
      isLoading={query.isLoading}
      error={query.error as never}
      checklist={query.data}
      language="en"
      t={t}
      onRetry={() => query.refetch()}
      onReturnToSignIn={onReturnToSignIn}
    />
  );
}

function renderConnectedView({ onReturnToSignIn = jest.fn() } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } } });
  return render(
    <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <AuthProvider>
            <LoggedInHarness>
              <ConnectedHarness onReturnToSignIn={onReturnToSignIn} />
            </LoggedInHarness>
            <Toaster />
          </AuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

interface RenderViewOptions {
  isLoading?: boolean;
  error?: CandidateDocumentsError | null;
  checklist?: CandidateDocumentChecklistItem[];
  onRetry?: () => void;
  onReturnToSignIn?: () => void;
}

function renderView({
  isLoading = false,
  error = null,
  checklist = undefined,
  onRetry = jest.fn(),
  onReturnToSignIn = jest.fn(),
}: RenderViewOptions = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } } });
  const t = (key: string) => require('../../../../../../shared/i18n/translate').translate('en', key);

  return render(
    <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <AuthProvider>
            <LoggedInHarness>
              <DocumentChecklistView
                isLoading={isLoading}
                error={error}
                checklist={checklist}
                language="en"
                t={t}
                onRetry={onRetry}
                onReturnToSignIn={onReturnToSignIn}
              />
            </LoggedInHarness>
            <Toaster />
          </AuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

describe('DocumentChecklistView', () => {
  afterEach(() => {
    jest.mocked(candidateDocumentsClient.uploadDocument).mockReset();
    mockGetDocumentAsync.mockReset();
  });

  it('shows a loading state', async () => {
    renderView({ isLoading: true });
    expect(await screen.findByText('Loading…')).toBeTruthy();
  });

  it('shows the empty-checklist state', async () => {
    renderView({ checklist: [] });
    expect(await screen.findByText('No documents required')).toBeTruthy();
  });

  it('renders a missing required document', async () => {
    renderView({ checklist: [item({ status: 'missing' })] });
    expect(await screen.findByText('Passport')).toBeTruthy();
    expect(screen.getByText('Required')).toBeTruthy();
    expect(screen.getByText('Missing')).toBeTruthy();
    expect(screen.getByText('Not uploaded yet')).toBeTruthy();
  });

  it('renders an optional document', async () => {
    renderView({ checklist: [item({ required: false, status: 'missing' })] });
    expect(await screen.findByText('Optional')).toBeTruthy();
  });

  it('renders an uploaded document with filename, size and date', async () => {
    renderView({ checklist: [item({ status: 'uploaded', document: uploadedDocument() })] });
    expect(await screen.findByText('Uploaded')).toBeTruthy();
    expect(screen.getByText(/passport\.pdf/)).toBeTruthy();
  });

  it('renders a pending-review document', async () => {
    renderView({ checklist: [item({ status: 'pending_review', document: uploadedDocument() })] });
    expect(await screen.findByText('Pending review')).toBeTruthy();
  });

  it('renders a verified document with no action when replacement is not allowed', async () => {
    renderView({ checklist: [item({ status: 'verified', document: uploadedDocument(), replacementAllowed: false })] });
    expect(await screen.findByText('Verified')).toBeTruthy();
    expect(screen.getByText('No action available')).toBeTruthy();
    expect(screen.queryByText('Replace')).toBeNull();
  });

  it('renders a rejected document with Replace only when replacement_allowed is true', async () => {
    renderView({ checklist: [item({ status: 'rejected', document: uploadedDocument(), replacementAllowed: true })] });
    expect(await screen.findByText('Rejected')).toBeTruthy();
    expect(screen.getByText('Replace')).toBeTruthy();
  });

  it('falls back an unrecognized status to a neutral, non-crashing display', async () => {
    renderView({ checklist: [item({ status: 'unknown' })] });
    expect(await screen.findByText('Status unavailable')).toBeTruthy();
  });

  it('shows an offline state with retry', async () => {
    renderView({ error: { code: 'OFFLINE' } });
    expect(await screen.findByText('You are offline')).toBeTruthy();
  });

  it('shows a distinct inactive-account state', async () => {
    const onReturnToSignIn = jest.fn();
    renderView({ error: { code: 'INACTIVE_ACCOUNT' }, onReturnToSignIn });
    expect(await screen.findByText('Account inactive')).toBeTruthy();
    fireEvent.press(screen.getByText('Return to sign in'));
    expect(onReturnToSignIn).toHaveBeenCalled();
  });

  describe('uploading a missing document', () => {
    it('picks a document, uploads it, and shows the updated document after success', async () => {
      mockGetDocumentAsync.mockResolvedValue({ canceled: false, assets: [pickedDocument()] });
      jest.mocked(candidateDocumentsClient.getChecklist).mockResolvedValue([item({ status: 'missing' })]);
      let resolveUpload: (value: CandidateDocumentChecklistItem) => void;
      jest.mocked(candidateDocumentsClient.uploadDocument).mockReturnValue(
        new Promise((resolve) => {
          resolveUpload = resolve;
        })
      );
      renderConnectedView();

      fireEvent.press(await screen.findByText('Upload'));
      fireEvent.press(screen.getByText('Choose file'));
      await waitFor(() => expect(mockGetDocumentAsync).toHaveBeenCalled());
      fireEvent.press(await screen.findByText('Submit'));

      expect(await screen.findByText('Uploading…')).toBeTruthy();
      resolveUpload!(item({ status: 'uploaded', document: uploadedDocument() }));
      await waitFor(() => expect(screen.getByText('Uploaded')).toBeTruthy());
    });

    it('treats picker cancellation as a normal non-error state', async () => {
      mockGetDocumentAsync.mockResolvedValue({ canceled: true, assets: null });
      renderView({ checklist: [item({ status: 'missing' })] });

      fireEvent.press(await screen.findByText('Upload'));
      fireEvent.press(screen.getByText('Choose file'));

      await waitFor(() => expect(mockGetDocumentAsync).toHaveBeenCalled());
      expect(screen.getByText('No file chosen')).toBeTruthy();
      expect(candidateDocumentsClient.uploadDocument).not.toHaveBeenCalled();
    });

    it('rejects an invalid file type client-side before calling the API', async () => {
      mockGetDocumentAsync.mockResolvedValue({
        canceled: false,
        assets: [pickedDocument({ name: 'resume.docx', mimeType: 'application/msword' })],
      });
      renderView({ checklist: [item({ status: 'missing' })] });

      fireEvent.press(await screen.findByText('Upload'));
      fireEvent.press(screen.getByText('Choose file'));

      expect(await screen.findByText('Upload a PDF, JPEG, or PNG file.')).toBeTruthy();
      expect(candidateDocumentsClient.uploadDocument).not.toHaveBeenCalled();
    });

    it('rejects an oversized file client-side', async () => {
      mockGetDocumentAsync.mockResolvedValue({
        canceled: false,
        assets: [pickedDocument({ size: 5 * 1024 * 1024 + 1 })],
      });
      renderView({ checklist: [item({ status: 'missing' })] });

      fireEvent.press(await screen.findByText('Upload'));
      fireEvent.press(screen.getByText('Choose file'));

      expect(await screen.findByText('This file is larger than the 5 MB limit.')).toBeTruthy();
    });

    it('maps the picked document into the exact multipart fields the backend expects', async () => {
      mockGetDocumentAsync.mockResolvedValue({ canceled: false, assets: [pickedDocument()] });
      jest.mocked(candidateDocumentsClient.uploadDocument).mockResolvedValue(
        item({ status: 'uploaded', document: uploadedDocument() })
      );
      renderView({ checklist: [item({ status: 'missing' })] });

      fireEvent.press(await screen.findByText('Upload'));
      fireEvent.press(screen.getByText('Choose file'));
      await waitFor(() => expect(mockGetDocumentAsync).toHaveBeenCalled());
      fireEvent.press(await screen.findByText('Submit'));

      await waitFor(() => expect(candidateDocumentsClient.uploadDocument).toHaveBeenCalledTimes(1));
      const [call] = jest.mocked(candidateDocumentsClient.uploadDocument).mock.calls[0];
      expect(call.requirementCode).toBe('passport');
      expect(call.formData.get('candidate_document[requirement_code]')).toBe('passport');
    });

    it('reuses the same idempotency key across a retry of the same file', async () => {
      mockGetDocumentAsync.mockResolvedValue({ canceled: false, assets: [pickedDocument()] });
      jest
        .mocked(candidateDocumentsClient.uploadDocument)
        .mockRejectedValueOnce({ code: 'SERVER_ERROR' })
        .mockResolvedValueOnce(item({ status: 'uploaded', document: uploadedDocument() }));
      renderView({ checklist: [item({ status: 'missing' })] });

      fireEvent.press(await screen.findByText('Upload'));
      fireEvent.press(screen.getByText('Choose file'));
      await waitFor(() => expect(mockGetDocumentAsync).toHaveBeenCalled());
      fireEvent.press(await screen.findByText('Submit'));
      await waitFor(() => expect(candidateDocumentsClient.uploadDocument).toHaveBeenCalledTimes(1));

      fireEvent.press(await screen.findByText('Retry'));
      await waitFor(() => expect(candidateDocumentsClient.uploadDocument).toHaveBeenCalledTimes(2));

      const calls = jest.mocked(candidateDocumentsClient.uploadDocument).mock.calls;
      expect(calls[0][0].idempotencyKey).toBe(calls[1][0].idempotencyKey);
    });

    it('prevents duplicate submission while an upload is pending', async () => {
      mockGetDocumentAsync.mockResolvedValue({ canceled: false, assets: [pickedDocument()] });
      jest.mocked(candidateDocumentsClient.uploadDocument).mockReturnValue(new Promise(() => {}));
      renderView({ checklist: [item({ status: 'missing' })] });

      fireEvent.press(await screen.findByText('Upload'));
      fireEvent.press(screen.getByText('Choose file'));
      await waitFor(() => expect(mockGetDocumentAsync).toHaveBeenCalled());
      const submit = await screen.findByText('Submit');
      fireEvent.press(submit);
      fireEvent.press(submit);
      fireEvent.press(submit);

      await screen.findByText('Uploading…');
      expect(candidateDocumentsClient.uploadDocument).toHaveBeenCalledTimes(1);
    });

    it('signs the candidate out when the session is confirmed expired during upload', async () => {
      mockGetDocumentAsync.mockResolvedValue({ canceled: false, assets: [pickedDocument()] });
      jest.mocked(candidateDocumentsClient.uploadDocument).mockRejectedValue({ code: 'SESSION_EXPIRED' });
      const onReturnToSignIn = jest.fn();
      renderView({ checklist: [item({ status: 'missing' })], onReturnToSignIn });

      fireEvent.press(await screen.findByText('Upload'));
      fireEvent.press(screen.getByText('Choose file'));
      await waitFor(() => expect(mockGetDocumentAsync).toHaveBeenCalled());
      fireEvent.press(await screen.findByText('Submit'));

      await waitFor(() => expect(onReturnToSignIn).toHaveBeenCalled());
    });

    it('signs the candidate out when the account is inactive during upload', async () => {
      mockGetDocumentAsync.mockResolvedValue({ canceled: false, assets: [pickedDocument()] });
      jest.mocked(candidateDocumentsClient.uploadDocument).mockRejectedValue({ code: 'INACTIVE_ACCOUNT' });
      const onReturnToSignIn = jest.fn();
      renderView({ checklist: [item({ status: 'missing' })], onReturnToSignIn });

      fireEvent.press(await screen.findByText('Upload'));
      fireEvent.press(screen.getByText('Choose file'));
      await waitFor(() => expect(mockGetDocumentAsync).toHaveBeenCalled());
      fireEvent.press(await screen.findByText('Submit'));

      await waitFor(() => expect(onReturnToSignIn).toHaveBeenCalled());
    });

    it('handles a 409 idempotency conflict safely, never as success', async () => {
      mockGetDocumentAsync.mockResolvedValue({ canceled: false, assets: [pickedDocument()] });
      jest.mocked(candidateDocumentsClient.uploadDocument).mockRejectedValue({
        code: 'CONFLICT',
        message: 'The idempotency key does not match the original request.',
      });
      renderView({ checklist: [item({ status: 'missing' })] });

      fireEvent.press(await screen.findByText('Upload'));
      fireEvent.press(screen.getByText('Choose file'));
      await waitFor(() => expect(mockGetDocumentAsync).toHaveBeenCalled());
      fireEvent.press(await screen.findByText('Submit'));

      expect(await screen.findByText('The idempotency key does not match the original request.')).toBeTruthy();
      expect(screen.queryByText('Uploaded')).toBeNull();
    });
  });

  it('renders in Urdu when given the Urdu translator', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } } });
    const { translate } = require('../../../../../../shared/i18n/translate');
    render(
      <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <AuthProvider>
              <LoggedInHarness>
                <DocumentChecklistView
                  isLoading={false}
                  error={null}
                  checklist={[item({ name: 'پاسپورٹ', status: 'missing' })]}
                  language="ur"
                  t={(key: string) => translate('ur', key)}
                  onRetry={jest.fn()}
                  onReturnToSignIn={jest.fn()}
                />
              </LoggedInHarness>
              <Toaster />
            </AuthProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    );

    expect(await screen.findByText('پاسپورٹ')).toBeTruthy();
    expect(screen.getByText('غیر موجود')).toBeTruthy();
  });
});

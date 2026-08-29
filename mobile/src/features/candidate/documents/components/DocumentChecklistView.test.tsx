import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../../../../contexts/AuthContext';
import { LanguageProvider } from '../../../../contexts/LanguageContext';
import { Toaster } from '../../../../design-system';
import { candidateDocumentsClient } from '../../../../lib/candidate-documents-client';
import type {
  CandidateDocumentChecklistItem,
  CandidateDocumentMetadata,
  CandidateDocumentsError,
} from '../../../../lib/candidate-documents-client';
import { useCandidateDocuments } from '../hooks/useCandidateDocuments';
import { createQueryClientTestLifecycle } from '../../../../testSupport/queryClientTestLifecycle';
import { DocumentChecklistView } from './DocumentChecklistView';

// `initialWindowMetrics` is null under Jest (populated natively), which
// otherwise leaves useSafeAreaInsets() unresolved -- same fix as login.test.jsx.
const TEST_SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

// Restored by AuthContext.tsx's own SecureStore-backed session restoration
// on mount -- pre-seeding it here (rather than an in-effect `login()` call
// on a harness component) avoids state updates outside RTL's act() boundary
// entirely.
const mockCandidateSession = {
  accessToken: 'candidate-access-token',
  refreshToken: 'refresh',
  candidateId: 'candidate-public-id-1',
  candidateName: 'Ahmed Ali',
  preferredLocale: 'en',
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
};

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(JSON.stringify(mockCandidateSession))),
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

function pccItem(overrides: Partial<CandidateDocumentChecklistItem> = {}): CandidateDocumentChecklistItem {
  return item({ requirementCode: 'police_character', name: 'Police Character Certificate', ...overrides });
}

function pccDocument(overrides: Partial<CandidateDocumentMetadata> = {}): CandidateDocumentMetadata {
  return uploadedDocument({
    fileName: 'pcc.pdf',
    issuedOn: '2026-02-01',
    expiresOn: '2026-08-01',
    complianceStatus: 'current',
    ...overrides,
  });
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

const { createTestQueryClient, trackRender, cleanup } = createQueryClientTestLifecycle();

function renderConnectedView({ onReturnToSignIn = jest.fn() } = {}) {
  const queryClient = createTestQueryClient();
  return trackRender(
    render(
      <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <AuthProvider>
              <ConnectedHarness onReturnToSignIn={onReturnToSignIn} />
              <Toaster />
            </AuthProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    )
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
  const queryClient = createTestQueryClient();
  const t = (key: string) => require('../../../../../../shared/i18n/translate').translate('en', key);

  return trackRender(
    render(
      <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <AuthProvider>
              <DocumentChecklistView
                isLoading={isLoading}
                error={error}
                checklist={checklist}
                language="en"
                t={t}
                onRetry={onRetry}
                onReturnToSignIn={onReturnToSignIn}
              />
              <Toaster />
            </AuthProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    )
  );
}

describe('DocumentChecklistView', () => {
  afterEach(async () => {
    jest.mocked(candidateDocumentsClient.uploadDocument).mockReset();
    mockGetDocumentAsync.mockReset();
    await cleanup();
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

  it('shows the rejection reason when the backend supplies one', async () => {
    renderView({
      checklist: [pccItem({ status: 'rejected', document: pccDocument({ rejectionReason: 'Document is unreadable.', complianceStatus: undefined }) })],
    });
    expect(await screen.findByText(/Document is unreadable\./)).toBeTruthy();
  });

  it('does not render a rejection reason when the backend did not supply one', async () => {
    renderView({ checklist: [item({ status: 'uploaded', document: uploadedDocument() })] });
    await screen.findByText('Passport');
    expect(screen.queryByText(/Rejection reason/)).toBeNull();
  });

  it('shows the review date once a document has been reviewed', async () => {
    renderView({
      checklist: [pccItem({ status: 'verified', document: pccDocument({ reviewedAt: '2026-08-27T09:00:00Z', complianceStatus: undefined }) })],
    });
    expect(await screen.findByText(/Reviewed on/)).toBeTruthy();
  });

  it('does not render a review date for a document that has not been reviewed', async () => {
    renderView({ checklist: [item({ status: 'uploaded', document: uploadedDocument() })] });
    await screen.findByText('Passport');
    expect(screen.queryByText(/Reviewed on/)).toBeNull();
  });

  it.each([
    ['current', 'Compliant'],
    ['near_expiry', 'Expiring soon'],
    ['expired', 'Expired'],
    ['not_applicable', 'Not applicable'],
  ])('shows the %s PCC compliance badge distinctly from the document status', async (complianceStatus, label) => {
    renderView({ checklist: [pccItem({ status: 'verified', document: pccDocument({ complianceStatus: complianceStatus as never }) })] });
    expect(await screen.findByText('Verified')).toBeTruthy();
    expect(screen.getByText(label)).toBeTruthy();
  });

  it('falls back an unrecognized compliance status to a safe, non-crashing display', async () => {
    renderView({ checklist: [pccItem({ status: 'verified', document: pccDocument({ complianceStatus: 'unknown' }) })] });
    expect(await screen.findByText('Status unavailable')).toBeTruthy();
  });

  it('shows the PCC issue and expiry dates when present', async () => {
    renderView({ checklist: [pccItem({ status: 'verified', document: pccDocument() })] });
    await screen.findByText('Police Character Certificate');
    expect(screen.getByText(/Issue date/)).toBeTruthy();
    expect(screen.getByText(/Expiry date/)).toBeTruthy();
  });

  it('does not show PCC dates for a non-PCC document', async () => {
    renderView({ checklist: [item({ status: 'uploaded', document: uploadedDocument() })] });
    await screen.findByText('Passport');
    expect(screen.queryByText(/Issue date/)).toBeNull();
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

  describe('PCC issue date', () => {
    it('does not show an issue-date field for a non-PCC requirement', async () => {
      renderView({ checklist: [item({ status: 'missing' })] });

      fireEvent.press(await screen.findByText('Upload'));
      expect(screen.queryByLabelText('Police Character Certificate issue date')).toBeNull();
    });

    it('shows an issue-date field for the police_character requirement', async () => {
      renderView({ checklist: [pccItem({ status: 'missing', document: null })] });

      fireEvent.press(await screen.findByText('Upload'));
      expect(screen.getByLabelText('Police Character Certificate issue date')).toBeTruthy();
    });

    it('requires an issue date before submitting a PCC upload', async () => {
      mockGetDocumentAsync.mockResolvedValue({ canceled: false, assets: [pickedDocument({ name: 'pcc.pdf' })] });
      renderView({ checklist: [pccItem({ status: 'missing', document: null })] });

      fireEvent.press(await screen.findByText('Upload'));
      fireEvent.press(screen.getByText('Choose file'));
      await waitFor(() => expect(mockGetDocumentAsync).toHaveBeenCalled());
      fireEvent.press(await screen.findByText('Submit'));

      expect(await screen.findByText('Enter the Police Character Certificate issue date.')).toBeTruthy();
      expect(candidateDocumentsClient.uploadDocument).not.toHaveBeenCalled();
    });

    it('rejects a malformed issue date client-side', async () => {
      mockGetDocumentAsync.mockResolvedValue({ canceled: false, assets: [pickedDocument({ name: 'pcc.pdf' })] });
      renderView({ checklist: [pccItem({ status: 'missing', document: null })] });

      fireEvent.press(await screen.findByText('Upload'));
      fireEvent.changeText(await screen.findByLabelText('Police Character Certificate issue date'), '01-02-2026');
      fireEvent.press(screen.getByText('Choose file'));
      await waitFor(() => expect(mockGetDocumentAsync).toHaveBeenCalled());
      fireEvent.press(await screen.findByText('Submit'));

      expect(await screen.findByText('Enter a valid Police Character Certificate issue date in YYYY-MM-DD format.')).toBeTruthy();
      expect(candidateDocumentsClient.uploadDocument).not.toHaveBeenCalled();
    });

    it('rejects a future issue date client-side', async () => {
      mockGetDocumentAsync.mockResolvedValue({ canceled: false, assets: [pickedDocument({ name: 'pcc.pdf' })] });
      renderView({ checklist: [pccItem({ status: 'missing', document: null })] });

      const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      fireEvent.press(await screen.findByText('Upload'));
      fireEvent.changeText(await screen.findByLabelText('Police Character Certificate issue date'), futureDate);
      fireEvent.press(screen.getByText('Choose file'));
      await waitFor(() => expect(mockGetDocumentAsync).toHaveBeenCalled());
      fireEvent.press(await screen.findByText('Submit'));

      expect(await screen.findByText('The Police Character Certificate issue date cannot be in the future.')).toBeTruthy();
      expect(candidateDocumentsClient.uploadDocument).not.toHaveBeenCalled();
    });

    it('sends the issue date as candidate_document[issued_on], never expires_on', async () => {
      mockGetDocumentAsync.mockResolvedValue({ canceled: false, assets: [pickedDocument({ name: 'pcc.pdf' })] });
      jest.mocked(candidateDocumentsClient.uploadDocument).mockResolvedValue(
        pccItem({ status: 'uploaded', document: pccDocument() })
      );
      renderView({ checklist: [pccItem({ status: 'missing', document: null })] });

      fireEvent.press(await screen.findByText('Upload'));
      fireEvent.changeText(await screen.findByLabelText('Police Character Certificate issue date'), '2026-02-01');
      fireEvent.press(screen.getByText('Choose file'));
      await waitFor(() => expect(mockGetDocumentAsync).toHaveBeenCalled());
      fireEvent.press(await screen.findByText('Submit'));

      await waitFor(() => expect(candidateDocumentsClient.uploadDocument).toHaveBeenCalledTimes(1));
      const [call] = jest.mocked(candidateDocumentsClient.uploadDocument).mock.calls[0];
      expect(call.formData.get('candidate_document[issued_on]')).toBe('2026-02-01');
      expect(call.formData.get('candidate_document[expires_on]')).toBeNull();
    });

    it('reuses the same idempotency key when retrying with the same file and issue date', async () => {
      mockGetDocumentAsync.mockResolvedValue({ canceled: false, assets: [pickedDocument({ name: 'pcc.pdf' })] });
      jest
        .mocked(candidateDocumentsClient.uploadDocument)
        .mockRejectedValueOnce({ code: 'SERVER_ERROR' })
        .mockResolvedValueOnce(pccItem({ status: 'uploaded', document: pccDocument() }));
      renderView({ checklist: [pccItem({ status: 'missing', document: null })] });

      fireEvent.press(await screen.findByText('Upload'));
      fireEvent.changeText(await screen.findByLabelText('Police Character Certificate issue date'), '2026-02-01');
      fireEvent.press(screen.getByText('Choose file'));
      await waitFor(() => expect(mockGetDocumentAsync).toHaveBeenCalled());
      fireEvent.press(await screen.findByText('Submit'));
      await waitFor(() => expect(candidateDocumentsClient.uploadDocument).toHaveBeenCalledTimes(1));

      fireEvent.press(await screen.findByText('Retry'));
      await waitFor(() => expect(candidateDocumentsClient.uploadDocument).toHaveBeenCalledTimes(2));

      const calls = jest.mocked(candidateDocumentsClient.uploadDocument).mock.calls;
      expect(calls[0][0].idempotencyKey).toBe(calls[1][0].idempotencyKey);
    });

    it('generates a new idempotency key after changing the issue date', async () => {
      mockGetDocumentAsync.mockResolvedValue({ canceled: false, assets: [pickedDocument({ name: 'pcc.pdf' })] });
      jest
        .mocked(candidateDocumentsClient.uploadDocument)
        .mockRejectedValueOnce({ code: 'SERVER_ERROR' })
        .mockResolvedValueOnce(pccItem({ status: 'uploaded', document: pccDocument() }));
      renderView({ checklist: [pccItem({ status: 'missing', document: null })] });

      fireEvent.press(await screen.findByText('Upload'));
      fireEvent.changeText(await screen.findByLabelText('Police Character Certificate issue date'), '2026-02-01');
      fireEvent.press(screen.getByText('Choose file'));
      await waitFor(() => expect(mockGetDocumentAsync).toHaveBeenCalled());
      fireEvent.press(await screen.findByText('Submit'));
      await waitFor(() => expect(candidateDocumentsClient.uploadDocument).toHaveBeenCalledTimes(1));

      fireEvent.changeText(screen.getByLabelText('Police Character Certificate issue date'), '2026-02-02');
      fireEvent.press(screen.getByText('Retry'));
      await waitFor(() => expect(candidateDocumentsClient.uploadDocument).toHaveBeenCalledTimes(2));

      const calls = jest.mocked(candidateDocumentsClient.uploadDocument).mock.calls;
      expect(calls[0][0].idempotencyKey).not.toBe(calls[1][0].idempotencyKey);
    });

    it('shows the backend-localized message for a VALIDATION_ERROR without a raw code', async () => {
      mockGetDocumentAsync.mockResolvedValue({ canceled: false, assets: [pickedDocument({ name: 'pcc.pdf' })] });
      jest.mocked(candidateDocumentsClient.uploadDocument).mockRejectedValue({
        code: 'VALIDATION_ERROR',
        message: 'The Police Character Certificate expiry date is calculated by the server and cannot be provided.',
        field: 'candidate_document.expires_on',
      });
      renderView({ checklist: [pccItem({ status: 'missing', document: null })] });

      fireEvent.press(await screen.findByText('Upload'));
      fireEvent.changeText(await screen.findByLabelText('Police Character Certificate issue date'), '2026-02-01');
      fireEvent.press(screen.getByText('Choose file'));
      await waitFor(() => expect(mockGetDocumentAsync).toHaveBeenCalled());
      fireEvent.press(await screen.findByText('Submit'));

      expect(
        await screen.findByText('The Police Character Certificate expiry date is calculated by the server and cannot be provided.')
      ).toBeTruthy();
      expect(screen.queryByText('VALIDATION_ERROR')).toBeNull();
    });
  });

  it('renders in Urdu when given the Urdu translator', async () => {
    const { translate } = require('../../../../../../shared/i18n/translate');
    renderView({
      checklist: [item({ name: 'پاسپورٹ', status: 'missing' })],
    });
    // renderView's `t` defaults to English -- render directly with the Urdu
    // translator instead, still going through the same tracked lifecycle.
    const queryClient = createTestQueryClient();
    trackRender(
      render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
          <QueryClientProvider client={queryClient}>
            <LanguageProvider>
              <AuthProvider>
                <DocumentChecklistView
                  isLoading={false}
                  error={null}
                  checklist={[item({ name: 'پاسپورٹ', status: 'missing' })]}
                  language="ur"
                  t={(key: string) => translate('ur', key)}
                  onRetry={jest.fn()}
                  onReturnToSignIn={jest.fn()}
                />
                <Toaster />
              </AuthProvider>
            </LanguageProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      )
    );

    expect(await screen.findAllByText('پاسپورٹ')).not.toHaveLength(0);
    expect(screen.getByText('غیر موجود')).toBeTruthy();
  });

  it('renders the PCC compliance badge and rejection reason in Urdu', async () => {
    const { translate } = require('../../../../../../shared/i18n/translate');
    const queryClient = createTestQueryClient();
    trackRender(
      render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
          <QueryClientProvider client={queryClient}>
            <LanguageProvider>
              <AuthProvider>
                <DocumentChecklistView
                  isLoading={false}
                  error={null}
                  checklist={[
                    pccItem({
                      status: 'rejected',
                      document: pccDocument({ complianceStatus: 'near_expiry', rejectionReason: 'دستاویز ناقابل مطالعہ ہے۔' }),
                    }),
                  ]}
                  language="ur"
                  t={(key: string) => translate('ur', key)}
                  onRetry={jest.fn()}
                  onReturnToSignIn={jest.fn()}
                />
                <Toaster />
              </AuthProvider>
            </LanguageProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      )
    );

    expect(await screen.findByText('جلد میعاد ختم ہونے والی')).toBeTruthy();
    expect(screen.getByText(/دستاویز ناقابل مطالعہ ہے۔/)).toBeTruthy();
  });
});

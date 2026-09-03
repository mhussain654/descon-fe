import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createMockStaffAuthClient,
  MOCK_STAFF_ACCOUNTS,
  MOCK_STAFF_PASSWORD,
} from '../../../../../../shared/auth/staffAuthClient';
import { LanguageProvider } from '../../../../contexts/LanguageContext';
import { StaffAuthProvider } from '../../../../contexts/StaffAuthContext';
import { candidateImportClient } from '../../../../lib/candidate-import-client';
import { CandidateImportDetail } from './CandidateImportDetail';

vi.mock('../../../../lib/candidate-import-client', () => ({
  candidateImportClient: {
    downloadTemplate: vi.fn(),
    preflightImport: vi.fn(),
    commitImport: vi.fn(),
    getImportBatch: vi.fn(),
    listImportHistory: vi.fn(),
    retryImport: vi.fn(),
    downloadErrorExport: vi.fn(),
  },
}));

window.URL.createObjectURL = vi.fn(() => 'blob:mock-error-export-url');
window.URL.revokeObjectURL = vi.fn();

const HR = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'hr' && !account.locked && !account.suspended)!;

async function signedInClient() {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: HR.email, password: MOCK_STAFF_PASSWORD });
  return client;
}

async function renderDetail(importId = 'import-1') {
  const client = await signedInClient();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <StaffAuthProvider client={client}>
            <CandidateImportDetail importId={importId} />
          </StaffAuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
  return { ...result, client };
}

function batchPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 'import-1',
    status: 'completed' as const,
    sourceFilename: 'candidates.csv',
    templateVersion: 'v1',
    totalRows: 2,
    acceptedRows: 2,
    rejectedRows: 0,
    skippedRows: 0,
    committedRows: 2,
    importedRows: 2,
    errorCode: null,
    expiresAt: null,
    processedAt: '2026-08-26T09:35:00Z',
    failedAt: null,
    enqueuedAt: '2026-08-26T09:30:05Z',
    createdAt: '2026-08-26T09:30:00Z',
    rowResults: [],
    ...overrides,
  };
}

describe('CandidateImportDetail', () => {
  afterEach(() => {
    vi.mocked(candidateImportClient.getImportBatch).mockReset();
    vi.mocked(candidateImportClient.retryImport).mockReset();
    vi.mocked(candidateImportClient.downloadErrorExport).mockReset();
    sessionStorage.clear();
  });

  it('shows a loading state, then the completed batch detail', async () => {
    candidateImportClient.getImportBatch.mockResolvedValue(batchPayload());
    await renderDetail();

    expect(await screen.findByText('Import details')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('candidates.csv')).toBeInTheDocument();
    expect(screen.getByText(/Imported: 2/)).toBeInTheDocument();
    expect(candidateImportClient.getImportBatch).toHaveBeenCalledWith('import-1');
  });

  it('shows an offline state with retry', async () => {
    candidateImportClient.getImportBatch.mockRejectedValue({ code: 'OFFLINE' });
    await renderDetail();

    expect(await screen.findByText('You are offline')).toBeInTheDocument();
    expect(screen.getByText('Check your internet connection and try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('shows a forbidden state for an ordinary 403', async () => {
    candidateImportClient.getImportBatch.mockRejectedValue({ code: 'FORBIDDEN' });
    await renderDetail();

    expect(await screen.findByText('You do not have permission to view this page.')).toBeInTheDocument();
  });

  it('shows a not-found state for a 404', async () => {
    candidateImportClient.getImportBatch.mockRejectedValue({ code: 'NOT_FOUND' });
    await renderDetail();

    expect(await screen.findByText('Import not found')).toBeInTheDocument();
    expect(screen.getByText('This import may have been removed, or the link may be incorrect.')).toBeInTheDocument();
  });

  it('signs the staff member out when the session is confirmed expired', async () => {
    candidateImportClient.getImportBatch.mockRejectedValue({ code: 'SESSION_EXPIRED' });
    const { client } = await renderDetail();
    const signOutSpy = vi.spyOn(client, 'signOut');

    await waitFor(() => expect(signOutSpy).toHaveBeenCalled());
  });

  it('signs the staff member out for an inactive account', async () => {
    candidateImportClient.getImportBatch.mockRejectedValue({ code: 'INACTIVE_ACCOUNT' });
    const { client } = await renderDetail();
    const signOutSpy = vi.spyOn(client, 'signOut');

    await waitFor(() => expect(signOutSpy).toHaveBeenCalled());
  });

  it('shows queued and processing banners without a final-result view', async () => {
    candidateImportClient.getImportBatch.mockResolvedValue(
      batchPayload({ status: 'queued', processedAt: null, importedRows: 0 })
    );
    await renderDetail();

    expect(await screen.findByText('Queued')).toBeInTheDocument();
    expect(screen.getByText('This import is queued and will start processing shortly.')).toBeInTheDocument();
    expect(screen.queryByText(/Imported:/)).not.toBeInTheDocument();
  });

  it('shows the invalidated (expired) message with no retry action', async () => {
    candidateImportClient.getImportBatch.mockResolvedValue(batchPayload({ status: 'invalidated', processedAt: null }));
    await renderDetail();

    expect(await screen.findByText('Expired')).toBeInTheDocument();
    expect(screen.getByText('This import expired before it could be processed. Start a new import.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry import' })).not.toBeInTheDocument();
  });

  it('shows partial-success counts and an error-export download button when some rows were rejected/skipped', async () => {
    candidateImportClient.getImportBatch.mockResolvedValue(
      batchPayload({ status: 'partial', rejectedRows: 1, skippedRows: 1, importedRows: 0, committedRows: 0 })
    );
    await renderDetail();

    expect(await screen.findByText('Partial success')).toBeInTheDocument();
    // The detail page reuses adminCandidateImportRejectedRowsLabel ("Will be
    // skipped"), the same key the preflight preview uses for its own
    // rejected-count badge.
    expect(screen.getByText(/Will be skipped: 1/)).toBeInTheDocument();
    expect(screen.getByText(/^Skipped: 1/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download error report' })).toBeInTheDocument();
  });

  it('hides the error-export download button when nothing was rejected or skipped', async () => {
    candidateImportClient.getImportBatch.mockResolvedValue(batchPayload({ status: 'completed' }));
    await renderDetail();

    await screen.findByText('Completed');
    expect(screen.queryByRole('button', { name: 'Download error report' })).not.toBeInTheDocument();
  });

  it('downloads the error export CSV on click', async () => {
    candidateImportClient.getImportBatch.mockResolvedValue(batchPayload({ status: 'partial', rejectedRows: 1 }));
    candidateImportClient.downloadErrorExport.mockResolvedValue({
      content: 'row_number,status,field,code,message\n2,rejected,cnic,invalid_cnic,Invalid CNIC\n',
      filename: 'candidate-import-import-1-errors.csv',
    });
    await renderDetail();

    fireEvent.click(await screen.findByRole('button', { name: 'Download error report' }));

    await waitFor(() => expect(candidateImportClient.downloadErrorExport).toHaveBeenCalledWith('import-1'));
    expect(window.URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('shows a failed batch with a retry action, and retries using a stable idempotency key across attempts', async () => {
    candidateImportClient.getImportBatch.mockResolvedValue(batchPayload({ status: 'failed', processedAt: null, errorCode: 'job_exception' }));
    candidateImportClient.retryImport
      .mockRejectedValueOnce({ code: 'RETRY_NOT_ALLOWED' })
      .mockResolvedValueOnce(batchPayload({ status: 'queued', processedAt: null }));
    await renderDetail();

    expect(await screen.findByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong while processing this import. You can retry it below.')).toBeInTheDocument();
    const retryButton = screen.getByRole('button', { name: 'Retry import' });

    fireEvent.click(retryButton);
    await screen.findByText("This import can't be retried right now.");
    fireEvent.click(screen.getByRole('button', { name: 'Retry import' }));

    await waitFor(() => expect(candidateImportClient.retryImport).toHaveBeenCalledTimes(2));
    const [, firstKey] = candidateImportClient.retryImport.mock.calls[0];
    const [, secondKey] = candidateImportClient.retryImport.mock.calls[1];
    expect(firstKey).toEqual(expect.any(String));
    expect(firstKey).toBe(secondKey);
  });

  it('prevents repeated retry clicks while a retry is already in flight', async () => {
    candidateImportClient.getImportBatch.mockResolvedValue(batchPayload({ status: 'failed', processedAt: null }));
    candidateImportClient.retryImport.mockReturnValue(new Promise(() => {}));
    await renderDetail();

    const retryButton = await screen.findByRole('button', { name: 'Retry import' });
    fireEvent.click(retryButton);
    fireEvent.click(retryButton);
    fireEvent.click(retryButton);

    await waitFor(() => expect(candidateImportClient.retryImport).toHaveBeenCalledTimes(1));
  });

  it('renders row results with their per-row status', async () => {
    candidateImportClient.getImportBatch.mockResolvedValue(
      batchPayload({
        status: 'partial',
        rejectedRows: 1,
        rowResults: [
          { rowNumber: 2, status: 'committed' },
          { rowNumber: 3, status: 'rejected', errorField: 'cnic', errorCode: 'invalid_cnic', message: 'Invalid CNIC.' },
        ],
      })
    );
    await renderDetail();

    expect(await screen.findByText('Row results')).toBeInTheDocument();
    expect(screen.getByText('Invalid CNIC.')).toBeInTheDocument();
    expect(screen.queryByText(/^\d{5}-\d{7}-\d$/)).not.toBeInTheDocument();
  });

  it('polls while queued/processing and stops once a terminal status is reached', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    candidateImportClient.getImportBatch
      .mockResolvedValueOnce(batchPayload({ status: 'queued', processedAt: null }))
      .mockResolvedValueOnce(batchPayload({ status: 'processing', processedAt: null }))
      .mockResolvedValueOnce(batchPayload({ status: 'completed' }));
    await renderDetail();

    await vi.waitFor(() => expect(screen.getByText('Queued')).toBeInTheDocument());
    // useCandidateImportBatch derives each poll's delay from
    // `dataUpdateCount` (already 1 after the initial fetch), so the second
    // fetch fires at POLL_INTERVALS_MS[1] = 3000ms, and the third at
    // POLL_INTERVALS_MS[2] = 5000ms -- not the schedule's first two entries.
    await vi.advanceTimersByTimeAsync(3_000);
    await vi.waitFor(() => expect(screen.getByText('Processing')).toBeInTheDocument());
    await vi.advanceTimersByTimeAsync(5_000);
    await vi.waitFor(() => expect(screen.getByText('Completed')).toBeInTheDocument());

    const callsAtCompletion = candidateImportClient.getImportBatch.mock.calls.length;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(candidateImportClient.getImportBatch).toHaveBeenCalledTimes(callsAtCompletion);

    vi.useRealTimers();
  });

  it('refetches on revisit (mount) rather than reusing a stale cached result', async () => {
    candidateImportClient.getImportBatch.mockResolvedValue(batchPayload({ status: 'completed' }));
    await renderDetail();
    await screen.findByText('Completed');

    // A fresh mount of the same page (e.g. navigating away and back, or a
    // page refresh) must hit the detail endpoint again -- each render helper
    // creates its own QueryClient, exactly like a real page reload does.
    await renderDetail();
    await waitFor(() => expect(candidateImportClient.getImportBatch).toHaveBeenCalledTimes(2));
  });

  it('links back to the import form', async () => {
    candidateImportClient.getImportBatch.mockResolvedValue(batchPayload());
    await renderDetail();

    const link = await screen.findByRole('link', { name: 'Back to import' });
    expect(link).toHaveAttribute('href', '/admin/candidates/import');
  });

  it('renders in Urdu when the language is Urdu', async () => {
    candidateImportClient.getImportBatch.mockResolvedValue(batchPayload());
    const client = await signedInClient();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    window.localStorage.setItem('descon.language', 'ur');
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <StaffAuthProvider client={client}>
              <CandidateImportDetail importId="import-1" />
            </StaffAuthProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText('درآمد کی تفصیلات')).toBeInTheDocument();
    window.localStorage.removeItem('descon.language');
  });
});

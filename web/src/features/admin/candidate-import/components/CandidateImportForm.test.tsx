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
import { MAX_FILE_BYTES } from '../schemas/csvFile';
import { CandidateImportForm } from './CandidateImportForm';

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

// jsdom does not implement createObjectURL/revokeObjectURL at all -- see
// web/src/app/documents/page.test.jsx's identical stub for the same reason.
window.URL.createObjectURL = vi.fn(() => 'blob:mock-template-url');
window.URL.revokeObjectURL = vi.fn();

const HR = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'hr' && !account.locked && !account.suspended)!;

async function signedInClient() {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: HR.email, password: MOCK_STAFF_PASSWORD });
  return client;
}

async function renderForm() {
  const client = await signedInClient();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <StaffAuthProvider client={client}>
            <CandidateImportForm />
          </StaffAuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

/** Like renderForm, but also returns the signed-in client so a test can spy on/assert its signOut(). */
async function renderFormWithClient() {
  const client = await signedInClient();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <StaffAuthProvider client={client}>
            <CandidateImportForm />
          </StaffAuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
  return { ...result, client };
}

function csvFile(name = 'candidates.csv', sizeBytes = 100, type = 'text/csv') {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

function chooseFile(file: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

function preflightPayload(overrides: Record<string, unknown> = {}) {
  return {
    importId: 'import-1',
    preflightToken: 'preflight-token-1',
    expiresAt: '2026-08-26T09:30:00Z',
    acceptedRows: 2,
    rejectedRows: 0,
    warningCount: 0,
    totalRows: 2,
    errors: [],
    ...overrides,
  };
}

function commitAcceptedPayload(overrides: Record<string, unknown> = {}) {
  return {
    importId: 'import-1',
    status: 'queued' as const,
    totalRows: 2,
    acceptedRows: 2,
    rejectedRows: 0,
    skippedRows: 0,
    committedRows: 0,
    idempotencyKeyPresent: true,
    ...overrides,
  };
}

async function submitPreflight() {
  await renderForm();
  chooseFile(csvFile());
  fireEvent.click(screen.getByRole('button', { name: 'Upload and preview' }));
  await screen.findByText('Review before importing');
}

describe('CandidateImportForm', () => {
  afterEach(() => {
    vi.mocked(candidateImportClient.downloadTemplate).mockReset();
    vi.mocked(candidateImportClient.preflightImport).mockReset();
    vi.mocked(candidateImportClient.commitImport).mockReset();
    sessionStorage.clear();
  });

  describe('file selection', () => {
    it('rejects submission with no file chosen', async () => {
      await renderForm();
      fireEvent.click(screen.getByRole('button', { name: 'Upload and preview' }));

      expect(await screen.findByText('Choose a CSV file to import.')).toBeInTheDocument();
      expect(candidateImportClient.preflightImport).not.toHaveBeenCalled();
    });

    it('rejects an invalid file type before ever calling the API', async () => {
      await renderForm();
      chooseFile(csvFile('candidates.xlsx', 100, 'application/vnd.ms-excel'));

      expect(await screen.findByText('Only .csv files are supported.')).toBeInTheDocument();
      expect(candidateImportClient.preflightImport).not.toHaveBeenCalled();
    });

    it('rejects an oversized file before ever calling the API', async () => {
      await renderForm();
      chooseFile(csvFile('candidates.csv', MAX_FILE_BYTES + 1));

      expect(await screen.findByText('This file is larger than the 2 MB limit.')).toBeInTheDocument();
      expect(candidateImportClient.preflightImport).not.toHaveBeenCalled();
    });

    it('shows the selected filename and clears it via remove', async () => {
      await renderForm();
      chooseFile(csvFile('my-candidates.csv'));

      expect(await screen.findByText('Selected file: my-candidates.csv')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Remove file' }));
      expect(screen.getByText('No file chosen')).toBeInTheDocument();
    });
  });

  describe('template download', () => {
    it('downloads the real backend template on click, showing a loading state meanwhile', async () => {
      let resolveDownload: (value: { content: string; filename: string }) => void;
      candidateImportClient.downloadTemplate.mockReturnValue(
        new Promise((resolve) => {
          resolveDownload = resolve;
        })
      );
      await renderForm();

      fireEvent.click(screen.getByRole('button', { name: 'Download CSV template' }));
      expect(await screen.findByRole('button', { name: 'Downloading template…' })).toBeInTheDocument();

      resolveDownload!({ content: 'full_name,cnic\n', filename: 'candidate-import-template-v1.csv' });
      await waitFor(() => expect(screen.getByRole('button', { name: 'Download CSV template' })).toBeInTheDocument());
      expect(window.URL.createObjectURL).toHaveBeenCalledTimes(1);
      expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-template-url');
    });

    it('shows an inline error when the template download fails, without blocking the rest of the form', async () => {
      candidateImportClient.downloadTemplate.mockRejectedValue({ code: 'SERVER_ERROR' });
      await renderForm();

      fireEvent.click(screen.getByRole('button', { name: 'Download CSV template' }));

      expect(await screen.findByText("Couldn't download the template. Try again.")).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Upload and preview' })).toBeInTheDocument();
    });
  });

  describe('preflight preview', () => {
    it('submits the file and shows an uploading state, then the preview with accepted/rejected counts', async () => {
      let resolvePreflight: (value: ReturnType<typeof preflightPayload>) => void;
      candidateImportClient.preflightImport.mockReturnValue(
        new Promise((resolve) => {
          resolvePreflight = resolve;
        })
      );
      await renderForm();
      chooseFile(csvFile());
      fireEvent.click(screen.getByRole('button', { name: 'Upload and preview' }));

      expect(await screen.findByText('Uploading and validating your file…')).toBeInTheDocument();

      resolvePreflight!(preflightPayload());
      expect(await screen.findByText('Review before importing')).toBeInTheDocument();
      expect(screen.getByText(/Ready to import: 2/)).toBeInTheDocument();
      expect(screen.getByText(/Will be skipped: 0/)).toBeInTheDocument();
    });

    it('shows row-level errors and the expiry time, never a full CNIC', async () => {
      candidateImportClient.preflightImport.mockResolvedValue(
        preflightPayload({
          acceptedRows: 1,
          rejectedRows: 1,
          errors: [{ row: 2, field: 'cnic', code: 'invalid_cnic', message: 'Enter a valid CNIC in the format 00000-0000000-0.' }],
        })
      );
      await submitPreflight();

      expect(screen.getByText('Enter a valid CNIC in the format 00000-0000000-0.')).toBeInTheDocument();
      expect(screen.queryByText(/^\d{5}-\d{7}-\d$/)).not.toBeInTheDocument();
      expect(screen.getByText(/This preview expires at/)).toBeInTheDocument();
    });

    it('hides the confirm action when every row was rejected, since there is nothing to commit', async () => {
      candidateImportClient.preflightImport.mockResolvedValue(preflightPayload({ acceptedRows: 0, rejectedRows: 2 }));
      await submitPreflight();

      expect(screen.getByText('Every row in this file was invalid, blank or already existed.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Confirm import' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Choose a different file' })).toBeInTheDocument();
    });

    it('prevents repeated preflight submission while one is already in flight', async () => {
      candidateImportClient.preflightImport.mockReturnValue(new Promise(() => {}));
      await renderForm();
      chooseFile(csvFile());
      const submitButton = screen.getByRole('button', { name: 'Upload and preview' });
      fireEvent.click(submitButton);
      fireEvent.click(submitButton);
      fireEvent.click(submitButton);

      await screen.findByText('Uploading and validating your file…');
      expect(candidateImportClient.preflightImport).toHaveBeenCalledTimes(1);
    });

    it('handles an ordinary permission-denied 403 by showing a forbidden message, without signing the user out', async () => {
      candidateImportClient.preflightImport.mockRejectedValue({ code: 'FORBIDDEN' });
      const { client } = await renderFormWithClient();
      const signOutSpy = vi.spyOn(client, 'signOut');
      chooseFile(csvFile());
      fireEvent.click(screen.getByRole('button', { name: 'Upload and preview' }));

      expect(await screen.findByText('You do not have permission to view this page.')).toBeInTheDocument();
      expect(signOutSpy).not.toHaveBeenCalled();
    });

    it('signs the staff member out when preflight fails because their session is confirmed expired', async () => {
      candidateImportClient.preflightImport.mockRejectedValue({ code: 'SESSION_EXPIRED' });
      const { client } = await renderFormWithClient();
      const signOutSpy = vi.spyOn(client, 'signOut');
      chooseFile(csvFile());
      fireEvent.click(screen.getByRole('button', { name: 'Upload and preview' }));

      await waitFor(() => expect(signOutSpy).toHaveBeenCalled());
    });

    it('signs the staff member out for an inactive account (403 inactive_account), distinct from an ordinary FORBIDDEN', async () => {
      candidateImportClient.preflightImport.mockRejectedValue({ code: 'INACTIVE_ACCOUNT' });
      const { client } = await renderFormWithClient();
      const signOutSpy = vi.spyOn(client, 'signOut');
      chooseFile(csvFile());
      fireEvent.click(screen.getByRole('button', { name: 'Upload and preview' }));

      await waitFor(() => expect(signOutSpy).toHaveBeenCalled());
      expect(screen.queryByText('You do not have permission to view this page.')).not.toBeInTheDocument();
    });

    it('handles a 409 conflict with a safe, translated message and a retry action', async () => {
      candidateImportClient.preflightImport.mockRejectedValue({
        code: 'CONFLICT',
        message: 'A request with this idempotency key is already processing.',
      });
      await renderForm();
      chooseFile(csvFile());
      fireEvent.click(screen.getByRole('button', { name: 'Upload and preview' }));

      expect(await screen.findByText('A request with this idempotency key is already processing.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });

    it('handles a network failure with retry, and a retry succeeds without a page reload', async () => {
      candidateImportClient.preflightImport.mockRejectedValueOnce({ code: 'NETWORK_ERROR' }).mockResolvedValueOnce(preflightPayload());
      await renderForm();
      chooseFile(csvFile());
      fireEvent.click(screen.getByRole('button', { name: 'Upload and preview' }));

      fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
      expect(await screen.findByText('Review before importing')).toBeInTheDocument();
    });

    it('handles a server failure safely, never exposing raw backend details', async () => {
      candidateImportClient.preflightImport.mockRejectedValue({ code: 'SERVER_ERROR' });
      await renderForm();
      chooseFile(csvFile());
      fireEvent.click(screen.getByRole('button', { name: 'Upload and preview' }));

      expect(await screen.findByText('Something went wrong.')).toBeInTheDocument();
      expect(screen.queryByText(/Internal Server Error|Traceback|Exception/i)).not.toBeInTheDocument();
    });
  });

  describe('confirm and commit', () => {
    it('confirms the preview and, once the 202 is accepted, shows submission confirmation with a link to the detail page -- never a final result inline', async () => {
      candidateImportClient.preflightImport.mockResolvedValue(preflightPayload());
      let resolveCommit: (value: ReturnType<typeof commitAcceptedPayload>) => void;
      candidateImportClient.commitImport.mockReturnValue(
        new Promise((resolve) => {
          resolveCommit = resolve;
        })
      );
      await submitPreflight();

      fireEvent.click(screen.getByRole('button', { name: 'Confirm import' }));
      expect(await screen.findByRole('button', { name: 'Confirm import' })).toBeDisabled();

      resolveCommit!(commitAcceptedPayload());
      expect(await screen.findByText('Import submitted')).toBeInTheDocument();
      expect(screen.getByText(/isn't the final result/)).toBeInTheDocument();
      const detailsLink = screen.getByRole('link', { name: 'View details' });
      expect(detailsLink).toHaveAttribute('href', '/admin/candidates/import/import-1');
    });

    it('prevents repeated confirm clicks while a commit is already in flight', async () => {
      candidateImportClient.preflightImport.mockResolvedValue(preflightPayload());
      candidateImportClient.commitImport.mockReturnValue(new Promise(() => {}));
      await submitPreflight();
      const confirmButton = screen.getByRole('button', { name: 'Confirm import' });
      fireEvent.click(confirmButton);
      fireEvent.click(confirmButton);
      fireEvent.click(confirmButton);

      await waitFor(() => expect(candidateImportClient.commitImport).toHaveBeenCalledTimes(1));
    });

    it('sends a fresh idempotency key on the first commit attempt, and reuses it across a retry', async () => {
      candidateImportClient.preflightImport.mockResolvedValue(preflightPayload());
      candidateImportClient.commitImport.mockRejectedValueOnce({ code: 'SERVER_ERROR' }).mockResolvedValueOnce(commitAcceptedPayload());
      await submitPreflight();
      fireEvent.click(screen.getByRole('button', { name: 'Confirm import' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));

      await waitFor(() => expect(candidateImportClient.commitImport).toHaveBeenCalledTimes(2));
      const [firstToken, firstKey] = candidateImportClient.commitImport.mock.calls[0];
      const [secondToken, secondKey] = candidateImportClient.commitImport.mock.calls[1];
      expect(firstToken).toBe('preflight-token-1');
      expect(secondToken).toBe('preflight-token-1');
      expect(firstKey).toBe(secondKey);
      expect(firstKey).toEqual(expect.any(String));
    });

    it('shows a distinct expired-preview message with a re-validate action, never a plain retry, when the preflight token has expired', async () => {
      candidateImportClient.preflightImport.mockResolvedValue(preflightPayload());
      candidateImportClient.commitImport.mockRejectedValue({
        code: 'PREFLIGHT_EXPIRED',
        message: 'This import preview has expired.',
      });
      await submitPreflight();
      fireEvent.click(screen.getByRole('button', { name: 'Confirm import' }));

      expect(await screen.findByText('This import preview has expired.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
      const revalidateButton = screen.getByRole('button', { name: 'Re-validate this file' });

      fireEvent.click(revalidateButton);
      // Back on the select step, with the same file still selected -- ready
      // to re-run preflight with one click, no re-picking from disk.
      expect(await screen.findByText('Selected file: candidates.csv')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Upload and preview' })).toBeInTheDocument();
    });
  });

  describe('correction / re-upload flow', () => {
    it('allows choosing a different file from the preview screen, clearing the previous preview', async () => {
      candidateImportClient.preflightImport.mockResolvedValue(preflightPayload());
      await submitPreflight();

      fireEvent.click(screen.getByRole('button', { name: 'Choose a different file' }));
      expect(screen.queryByText('Review before importing')).not.toBeInTheDocument();
      expect(screen.getByText('No file chosen')).toBeInTheDocument();
    });

    it('allows starting a new import after a submission was confirmed, clearing the previous confirmation', async () => {
      candidateImportClient.preflightImport.mockResolvedValue(preflightPayload());
      candidateImportClient.commitImport.mockResolvedValue(commitAcceptedPayload());
      await submitPreflight();
      fireEvent.click(screen.getByRole('button', { name: 'Confirm import' }));
      await screen.findByText('Import submitted');

      fireEvent.click(screen.getByRole('button', { name: 'Choose a different file' }));
      expect(screen.queryByText('Import submitted')).not.toBeInTheDocument();
      expect(screen.getByText('No file chosen')).toBeInTheDocument();
    });
  });

  it('links to the import history list', async () => {
    await renderForm();

    const link = screen.getByRole('link', { name: 'View import history' });
    expect(link).toHaveAttribute('href', '/admin/candidates/import/history');
  });

  it('renders in Urdu when the language is Urdu', async () => {
    const client = await signedInClient();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    window.localStorage.setItem('descon.language', 'ur');
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <StaffAuthProvider client={client}>
              <CandidateImportForm />
            </StaffAuthProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText('امیدوار درآمد کریں')).toBeInTheDocument();
    window.localStorage.removeItem('descon.language');
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
  candidateImportClient: { importCandidates: vi.fn() },
}));

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
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <StaffAuthProvider client={client}>
          <CandidateImportForm />
        </StaffAuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

function csvFile(name = 'candidates.csv', sizeBytes = 100, type = 'text/csv') {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

function chooseFile(file) {
  const input = document.querySelector('input[type="file"]');
  fireEvent.change(input, { target: { files: [file] } });
}

function resultPayload(overrides = {}) {
  return {
    successfulRows: 2,
    failedRows: 0,
    skippedRows: 0,
    totalRows: 2,
    errors: [],
    ...overrides,
  };
}

describe('CandidateImportForm', () => {
  afterEach(() => {
    vi.mocked(candidateImportClient.importCandidates).mockReset();
    sessionStorage.clear();
  });

  it('rejects submission with no file chosen', async () => {
    await renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Import candidates' }));

    expect(await screen.findByText('Choose a CSV file to import.')).toBeInTheDocument();
    expect(candidateImportClient.importCandidates).not.toHaveBeenCalled();
  });

  it('rejects an invalid file type before ever calling the API', async () => {
    await renderForm();
    chooseFile(csvFile('candidates.xlsx', 100, 'application/vnd.ms-excel'));

    expect(await screen.findByText('Only .csv files are supported.')).toBeInTheDocument();
    expect(candidateImportClient.importCandidates).not.toHaveBeenCalled();
  });

  it('rejects an oversized file before ever calling the API', async () => {
    await renderForm();
    chooseFile(csvFile('candidates.csv', MAX_FILE_BYTES + 1));

    expect(await screen.findByText('This file is larger than the 2 MB limit.')).toBeInTheDocument();
    expect(candidateImportClient.importCandidates).not.toHaveBeenCalled();
  });

  it('shows the selected filename and clears it via remove', async () => {
    await renderForm();
    chooseFile(csvFile('my-candidates.csv'));

    expect(await screen.findByText('Selected file: my-candidates.csv')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove file' }));
    expect(screen.getByText('No file chosen')).toBeInTheDocument();
  });

  it('submits the file and shows an uploading state, then the successful result', async () => {
    let resolveImport;
    candidateImportClient.importCandidates.mockReturnValue(
      new Promise((resolve) => {
        resolveImport = resolve;
      })
    );
    await renderForm();
    chooseFile(csvFile());
    fireEvent.click(screen.getByRole('button', { name: 'Import candidates' }));

    expect(await screen.findByText('Uploading and processing your file…')).toBeInTheDocument();

    resolveImport(resultPayload());
    expect(await screen.findByText('Import complete')).toBeInTheDocument();
    expect(screen.getByText(/Imported: 2/)).toBeInTheDocument();
  });

  it('prevents repeated submission while an import is already in flight', async () => {
    candidateImportClient.importCandidates.mockReturnValue(new Promise(() => {}));
    await renderForm();
    chooseFile(csvFile());
    const submitButton = screen.getByRole('button', { name: 'Import candidates' });
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);

    await screen.findByText('Uploading and processing your file…');
    expect(candidateImportClient.importCandidates).toHaveBeenCalledTimes(1);
  });

  it('shows a mixed result with row-level errors, never rendering a full CNIC', async () => {
    candidateImportClient.importCandidates.mockResolvedValue(
      resultPayload({
        successfulRows: 1,
        failedRows: 1,
        errors: [{ row: 2, field: 'cnic', code: 'invalid_cnic', message: 'Enter a valid CNIC in the format 00000-0000000-0.' }],
      })
    );
    await renderForm();
    chooseFile(csvFile());
    fireEvent.click(screen.getByRole('button', { name: 'Import candidates' }));

    expect(await screen.findByText('Import finished with some issues')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid CNIC in the format 00000-0000000-0.')).toBeInTheDocument();
    expect(screen.queryByText(/^\d{5}-\d{7}-\d$/)).not.toBeInTheDocument();
  });

  it('shows the empty-result state when nothing was imported', async () => {
    candidateImportClient.importCandidates.mockResolvedValue(
      resultPayload({ successfulRows: 0, failedRows: 1, skippedRows: 1, totalRows: 2 })
    );
    await renderForm();
    chooseFile(csvFile());
    fireEvent.click(screen.getByRole('button', { name: 'Import candidates' }));

    expect(await screen.findByText('No candidates were imported')).toBeInTheDocument();
  });

  it('allows choosing a corrected file after a failure, clearing the previous result', async () => {
    candidateImportClient.importCandidates.mockResolvedValue(resultPayload());
    await renderForm();
    chooseFile(csvFile());
    fireEvent.click(screen.getByRole('button', { name: 'Import candidates' }));
    await screen.findByText('Import complete');

    fireEvent.click(screen.getByRole('button', { name: 'Choose a different file' }));
    expect(screen.queryByText('Import complete')).not.toBeInTheDocument();
    expect(screen.getByText('No file chosen')).toBeInTheDocument();
  });

  it('handles a 409 conflict with a safe, translated message and a retry action', async () => {
    candidateImportClient.importCandidates.mockRejectedValue({
      code: 'CONFLICT',
      message: 'A request with this idempotency key is already processing.',
    });
    await renderForm();
    chooseFile(csvFile());
    fireEvent.click(screen.getByRole('button', { name: 'Import candidates' }));

    expect(await screen.findByText('A request with this idempotency key is already processing.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('handles a 429 rate limit safely with a retry action', async () => {
    candidateImportClient.importCandidates.mockRejectedValue({ code: 'RATE_LIMITED', retryAfterSeconds: 30 });
    await renderForm();
    chooseFile(csvFile());
    fireEvent.click(screen.getByRole('button', { name: 'Import candidates' }));

    expect(await screen.findByText('Too many attempts. Please wait a moment before trying again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('handles a network failure with retry, and a retry succeeds without a page reload', async () => {
    candidateImportClient.importCandidates
      .mockRejectedValueOnce({ code: 'NETWORK_ERROR' })
      .mockResolvedValueOnce(resultPayload());
    await renderForm();
    chooseFile(csvFile());
    fireEvent.click(screen.getByRole('button', { name: 'Import candidates' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Import complete')).toBeInTheDocument();
  });

  it('handles a server failure safely, never exposing raw backend details', async () => {
    candidateImportClient.importCandidates.mockRejectedValue({ code: 'SERVER_ERROR' });
    await renderForm();
    chooseFile(csvFile());
    fireEvent.click(screen.getByRole('button', { name: 'Import candidates' }));

    expect(await screen.findByText('Something went wrong.')).toBeInTheDocument();
    expect(screen.queryByText(/Internal Server Error|Traceback|Exception/i)).not.toBeInTheDocument();
  });

  it('reuses the same idempotency key across a retry of the same file', async () => {
    candidateImportClient.importCandidates
      .mockRejectedValueOnce({ code: 'SERVER_ERROR' })
      .mockResolvedValueOnce(resultPayload());
    await renderForm();
    chooseFile(csvFile());
    fireEvent.click(screen.getByRole('button', { name: 'Import candidates' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(candidateImportClient.importCandidates).toHaveBeenCalledTimes(2));
    const [, firstKey] = candidateImportClient.importCandidates.mock.calls[0];
    const [, secondKey] = candidateImportClient.importCandidates.mock.calls[1];
    expect(firstKey).toBe(secondKey);
    expect(firstKey).toEqual(expect.any(String));
  });

  it('renders in Urdu when the language is Urdu', async () => {
    const client = await signedInClient();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    window.localStorage.setItem('descon.language', 'ur');
    render(
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <StaffAuthProvider client={client}>
            <CandidateImportForm />
          </StaffAuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    );

    expect(await screen.findByText('اپ لوڈ کرنے سے پہلے')).toBeInTheDocument();
    window.localStorage.removeItem('descon.language');
  });
});

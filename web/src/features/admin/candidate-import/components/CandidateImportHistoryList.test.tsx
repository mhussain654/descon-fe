import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createMockStaffAuthClient,
  MOCK_STAFF_ACCOUNTS,
  MOCK_STAFF_PASSWORD,
} from '../../../../../../shared/auth/staffAuthClient';
import { LanguageProvider } from '../../../../contexts/LanguageContext';
import { StaffAuthProvider } from '../../../../contexts/StaffAuthContext';
import { candidateImportClient } from '../../../../lib/candidate-import-client';
import { CandidateImportHistoryList } from './CandidateImportHistoryList';

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

const HR = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'hr' && !account.locked && !account.suspended)!;

async function signedInClient() {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: HR.email, password: MOCK_STAFF_PASSWORD });
  return client;
}

function batchSummary(overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  };
}

function historyResult(
  items: Array<ReturnType<typeof batchSummary>>,
  pagination = { page: 1, perPage: 20, totalCount: items.length, totalPages: 1 }
) {
  return { items, pagination, appliedFilters: {} };
}

function renderAt(path: string, client: Awaited<ReturnType<typeof signedInClient>>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <StaffAuthProvider client={client}>
            <Routes>
              <Route path="/admin/login" element={<p>Login stub</p>} />
              <Route path="/admin/candidates/import" element={<p>Import form stub</p>} />
              <Route path="/admin/candidates/import/history" element={<CandidateImportHistoryList />} />
              <Route path="/admin/candidates/import/:id" element={<p>Import detail stub</p>} />
            </Routes>
          </StaffAuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('CandidateImportHistoryList', () => {
  afterEach(() => {
    vi.mocked(candidateImportClient.listImportHistory).mockReset();
    sessionStorage.clear();
  });

  describe('list states', () => {
    it('shows a loading state before the list resolves', async () => {
      candidateImportClient.listImportHistory.mockImplementation(() => new Promise(() => {}));
      const client = await signedInClient();
      renderAt('/admin/candidates/import/history', client);

      await waitFor(() => expect(screen.getByText('Loading…')).toBeInTheDocument());
    });

    it('shows the empty state when there are no imports and no active filters', async () => {
      candidateImportClient.listImportHistory.mockResolvedValue(historyResult([]));
      const client = await signedInClient();
      renderAt('/admin/candidates/import/history', client);

      expect(await screen.findByText('No imports yet')).toBeInTheDocument();
    });

    it('shows the empty-filtered state when filters are active and nothing matches', async () => {
      candidateImportClient.listImportHistory.mockResolvedValue(historyResult([]));
      const client = await signedInClient();
      renderAt('/admin/candidates/import/history?status=failed', client);

      expect(await screen.findByText('No imports match these filters')).toBeInTheDocument();
    });

    it('renders import rows with file, status, counts and submitted date', async () => {
      candidateImportClient.listImportHistory.mockResolvedValue(historyResult([batchSummary()]));
      const client = await signedInClient();
      renderAt('/admin/candidates/import/history', client);

      expect(await screen.findByText('candidates.csv')).toBeInTheDocument();
      expect(screen.getAllByText('Completed').length).toBeGreaterThan(0);
      expect(screen.getAllByRole('cell', { name: '2' }).length).toBe(2);
    });

    it('links each row to its import detail page', async () => {
      candidateImportClient.listImportHistory.mockResolvedValue(historyResult([batchSummary()]));
      const client = await signedInClient();
      renderAt('/admin/candidates/import/history', client);

      const link = await screen.findByRole('link', { name: 'candidates.csv' });
      expect(link).toHaveAttribute('href', '/admin/candidates/import/import-1');
    });

    it('shows an offline state with retry', async () => {
      candidateImportClient.listImportHistory.mockRejectedValue({ code: 'OFFLINE' });
      const client = await signedInClient();
      renderAt('/admin/candidates/import/history', client);

      expect(await screen.findByText('You are offline')).toBeInTheDocument();
    });

    it('shows a forbidden state for a 403', async () => {
      candidateImportClient.listImportHistory.mockRejectedValue({ code: 'FORBIDDEN' });
      const client = await signedInClient();
      renderAt('/admin/candidates/import/history', client);

      expect(await screen.findByText('Access restricted')).toBeInTheDocument();
    });

    it('shows a generic error with retry for a server error', async () => {
      candidateImportClient.listImportHistory.mockRejectedValue({ code: 'SERVER_ERROR' });
      const client = await signedInClient();
      renderAt('/admin/candidates/import/history', client);

      expect(await screen.findByText('Something went wrong.')).toBeInTheDocument();
      const retryButton = screen.getByRole('button', { name: 'Retry' });
      candidateImportClient.listImportHistory.mockResolvedValue(historyResult([batchSummary()]));
      fireEvent.click(retryButton);
      expect(await screen.findByText('candidates.csv')).toBeInTheDocument();
    });

    it('signs the staff member out on a confirmed-expired staff session', async () => {
      candidateImportClient.listImportHistory.mockRejectedValue({ code: 'SESSION_EXPIRED' });
      const client = await signedInClient();
      const signOutSpy = vi.spyOn(client, 'signOut');
      renderAt('/admin/candidates/import/history', client);

      await waitFor(() => expect(signOutSpy).toHaveBeenCalled());
    });

    it('signs the staff member out for an inactive account', async () => {
      candidateImportClient.listImportHistory.mockRejectedValue({ code: 'INACTIVE_ACCOUNT' });
      const client = await signedInClient();
      const signOutSpy = vi.spyOn(client, 'signOut');
      renderAt('/admin/candidates/import/history', client);

      await waitFor(() => expect(signOutSpy).toHaveBeenCalled());
    });
  });

  describe('filters and URL state', () => {
    it('preserves status, created-from, created-to and template-version filters from the URL on load', async () => {
      candidateImportClient.listImportHistory.mockResolvedValue(historyResult([]));
      const client = await signedInClient();
      renderAt(
        '/admin/candidates/import/history?status=failed&from=2026-08-01&to=2026-08-31&templateVersion=v1',
        client
      );

      await waitFor(() => {
        const [filters] = candidateImportClient.listImportHistory.mock.calls.at(-1)!;
        expect(filters).toEqual({
          status: 'failed',
          createdFrom: '2026-08-01',
          createdTo: '2026-08-31',
          templateVersion: 'v1',
        });
      });
      expect(screen.getByLabelText('Status')).toHaveValue('failed');
      expect(screen.getByLabelText('Template version')).toHaveValue('v1');
    });

    it('changing the status filter updates the request and the URL', async () => {
      candidateImportClient.listImportHistory.mockResolvedValue(historyResult([]));
      const client = await signedInClient();
      renderAt('/admin/candidates/import/history', client);

      const statusSelect = await screen.findByLabelText('Status');
      fireEvent.change(statusSelect, { target: { value: 'failed' } });

      await waitFor(() => {
        const [filters] = candidateImportClient.listImportHistory.mock.calls.at(-1)!;
        expect(filters.status).toBe('failed');
      });
    });

    it('resets the page to 1 when a filter changes', async () => {
      candidateImportClient.listImportHistory.mockResolvedValue(
        historyResult([], { page: 2, perPage: 20, totalCount: 45, totalPages: 3 })
      );
      const client = await signedInClient();
      renderAt('/admin/candidates/import/history?page=2', client);

      const statusSelect = await screen.findByLabelText('Status');
      fireEvent.change(statusSelect, { target: { value: 'completed' } });

      await waitFor(() => {
        const [, page] = candidateImportClient.listImportHistory.mock.calls.at(-1)!;
        expect(page.number).toBe(1);
      });
    });

    it('shows "Clear filters" only when filters are active, and clears them on click', async () => {
      candidateImportClient.listImportHistory.mockResolvedValue(historyResult([]));
      const client = await signedInClient();
      renderAt('/admin/candidates/import/history?status=failed', client);

      const clearButton = await screen.findByText('Clear filters');
      fireEvent.click(clearButton);

      await waitFor(() => expect(screen.getByLabelText('Status')).toHaveValue(''));
      expect(screen.queryByText('Clear filters')).not.toBeInTheDocument();
    });

    it('does not show Clear filters with no active filters', async () => {
      candidateImportClient.listImportHistory.mockResolvedValue(historyResult([]));
      const client = await signedInClient();
      renderAt('/admin/candidates/import/history', client);

      await waitFor(() => expect(candidateImportClient.listImportHistory).toHaveBeenCalled());
      expect(screen.queryByText('Clear filters')).not.toBeInTheDocument();
    });

    it('never exposes an actor/owner filter, since the list is always scoped to the signed-in staff member', async () => {
      candidateImportClient.listImportHistory.mockResolvedValue(historyResult([]));
      const client = await signedInClient();
      renderAt('/admin/candidates/import/history', client);

      await screen.findByText('No imports yet');
      expect(screen.queryByLabelText(/actor/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/owner/i)).not.toBeInTheDocument();
    });
  });

  describe('pagination', () => {
    it('requests the page reflected in the URL and renders Pagination controls', async () => {
      candidateImportClient.listImportHistory.mockResolvedValue(
        historyResult([batchSummary()], { page: 2, perPage: 20, totalCount: 45, totalPages: 3 })
      );
      const client = await signedInClient();
      renderAt('/admin/candidates/import/history?page=2', client);

      await waitFor(() => {
        const [, page] = candidateImportClient.listImportHistory.mock.calls.at(-1)!;
        expect(page.number).toBe(2);
      });
      expect(await screen.findByRole('navigation')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page');
    });

    it('clicking a page number requests that page and updates the URL', async () => {
      candidateImportClient.listImportHistory.mockResolvedValue(
        historyResult([batchSummary()], { page: 1, perPage: 20, totalCount: 45, totalPages: 3 })
      );
      const client = await signedInClient();
      renderAt('/admin/candidates/import/history', client);

      const pageThreeButton = await screen.findByRole('button', { name: '3' });
      fireEvent.click(pageThreeButton);

      await waitFor(() => {
        const [, page] = candidateImportClient.listImportHistory.mock.calls.at(-1)!;
        expect(page.number).toBe(3);
      });
    });
  });

  it('links back to the import form', async () => {
    candidateImportClient.listImportHistory.mockResolvedValue(historyResult([]));
    const client = await signedInClient();
    renderAt('/admin/candidates/import/history', client);

    const link = await screen.findByRole('link', { name: 'Back to import' });
    expect(link).toHaveAttribute('href', '/admin/candidates/import');
  });

  it('renders in Urdu', async () => {
    candidateImportClient.listImportHistory.mockResolvedValue(historyResult([batchSummary()]));
    window.localStorage.setItem('descon.language', 'ur');
    const client = await signedInClient();
    renderAt('/admin/candidates/import/history', client);

    expect(await screen.findByRole('heading', { name: 'درآمد کی تاریخ' })).toBeInTheDocument();
    window.localStorage.removeItem('descon.language');
  });
});

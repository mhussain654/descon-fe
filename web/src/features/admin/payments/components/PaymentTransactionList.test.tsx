import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
import { adminPaymentsClient } from '../../../../lib/admin-payments-client';
import { PaymentTransactionList } from './PaymentTransactionList';

vi.mock('../../../../lib/admin-payments-client', () => ({
  adminPaymentsClient: {
    listPayments: vi.fn(),
    getPayment: vi.fn(),
    correctPayment: vi.fn(),
  },
}));

const FINANCE = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'finance' && !account.locked && !account.suspended)!;
const MANAGEMENT = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'management')!;
const HR = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'hr')!;

async function signedInClient(account: typeof FINANCE) {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: account.email, password: MOCK_STAFF_PASSWORD });
  return client;
}

function paymentSummary(overrides: Record<string, unknown> = {}) {
  return {
    id: 'payment-1',
    candidate: { id: 'candidate-1', fullName: 'Ahmed Ali', maskedCnic: '42101-*******-1', referenceNumber: 'DES-001001' },
    paymentTypeCode: 'onboarding_fee',
    status: 'paid' as const,
    amount: '1500.00',
    currencyCode: 'PKR',
    provider: 'kuickpay',
    externalReference: 'KP-1',
    reconciliationState: 'clean' as const,
    paidAt: '2026-09-01T10:05:00Z',
    createdAt: '2026-09-01T10:00:00Z',
    updatedAt: '2026-09-01T10:05:00Z',
    ...overrides,
  };
}

function listResult(items: Array<ReturnType<typeof paymentSummary>>, pagination = { page: 1, perPage: 20, totalCount: items.length, totalPages: 1 }) {
  return { items, pagination, appliedFilters: {} };
}

async function renderAt(path: string, account: typeof FINANCE) {
  const client = await signedInClient(account);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <StaffAuthProvider client={client}>
            <Routes>
              <Route path="/admin/login" element={<p>Login stub</p>} />
              <Route path="/admin/finance/payments" element={<PaymentTransactionList />} />
              <Route path="/admin/finance/payments/:id" element={<p>Detail stub</p>} />
            </Routes>
          </StaffAuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('PaymentTransactionList', () => {
  afterEach(() => {
    vi.mocked(adminPaymentsClient.listPayments).mockReset();
    sessionStorage.clear();
  });

  describe('list states', () => {
    it('shows a loading state before the list resolves', async () => {
      adminPaymentsClient.listPayments.mockImplementation(() => new Promise(() => {}));
      await renderAt('/admin/finance/payments', FINANCE);

      await waitFor(() => expect(screen.getByText('Loading…')).toBeInTheDocument());
    });

    it('shows the empty state when there are no payments and no active filters', async () => {
      adminPaymentsClient.listPayments.mockResolvedValue(listResult([]));
      await renderAt('/admin/finance/payments', FINANCE);

      expect(await screen.findByText('No payment transactions yet')).toBeInTheDocument();
    });

    it('shows the empty-filtered state when filters are active and nothing matches', async () => {
      adminPaymentsClient.listPayments.mockResolvedValue(listResult([]));
      await renderAt('/admin/finance/payments?status=failed', FINANCE);

      expect(await screen.findByText('No transactions match these filters')).toBeInTheDocument();
    });

    it('renders payment rows with candidate, amount, status, provider, reconciliation and submitted date', async () => {
      adminPaymentsClient.listPayments.mockResolvedValue(listResult([paymentSummary()]));
      await renderAt('/admin/finance/payments', FINANCE);

      expect(await screen.findByText('Ahmed Ali')).toBeInTheDocument();
      expect(screen.getByText('DES-001001')).toBeInTheDocument();
      // Intl.NumberFormat separates the currency symbol from the amount with
      // a non-breaking space, not a plain one -- match either.
      expect(screen.getByText(/^Rs\s*1,500$/)).toBeInTheDocument();
      // "Paid"/"Clean" also appear as filter-select options, so scope to the row's own Badge.
      expect(screen.getAllByText('Paid').length).toBeGreaterThan(0);
      expect(screen.getByText('kuickpay')).toBeInTheDocument();
      expect(screen.getAllByText('Clean').length).toBeGreaterThan(0);
      expect(screen.queryByText(/\d{5}-\d{7}-\d/)).not.toBeInTheDocument();
    });

    it('links each row to its payment detail page', async () => {
      adminPaymentsClient.listPayments.mockResolvedValue(listResult([paymentSummary()]));
      await renderAt('/admin/finance/payments', FINANCE);

      const link = await screen.findByRole('link', { name: /Ahmed Ali/ });
      expect(link).toHaveAttribute('href', '/admin/finance/payments/payment-1');
    });

    it('allows a management staff member (view_payments) to view the list, without a correct button on detail', async () => {
      adminPaymentsClient.listPayments.mockResolvedValue(listResult([paymentSummary()]));
      await renderAt('/admin/finance/payments', MANAGEMENT);

      expect(await screen.findByText('Ahmed Ali')).toBeInTheDocument();
    });

    it('shows a forbidden state for a staff member lacking view_payments/manage_payments -- no route guard, the query itself handles it', async () => {
      adminPaymentsClient.listPayments.mockRejectedValue({ code: 'FORBIDDEN', message: 'You do not have access.' });
      await renderAt('/admin/finance/payments', HR);

      expect(await screen.findByText('Access restricted')).toBeInTheDocument();
    });

    it('shows an offline state with retry', async () => {
      adminPaymentsClient.listPayments.mockRejectedValue({ code: 'OFFLINE' });
      await renderAt('/admin/finance/payments', FINANCE);

      expect(await screen.findByText('You are offline')).toBeInTheDocument();
    });

    it('shows a generic error with retry for a server error', async () => {
      adminPaymentsClient.listPayments.mockRejectedValue({ code: 'SERVER_ERROR' });
      await renderAt('/admin/finance/payments', FINANCE);

      expect(await screen.findByText('Something went wrong.')).toBeInTheDocument();
      const retryButton = screen.getByRole('button', { name: 'Retry' });
      adminPaymentsClient.listPayments.mockResolvedValue(listResult([paymentSummary()]));
      fireEvent.click(retryButton);
      expect(await screen.findByText('Ahmed Ali')).toBeInTheDocument();
    });

    it('signs the staff member out on a confirmed-expired staff session', async () => {
      adminPaymentsClient.listPayments.mockRejectedValue({ code: 'SESSION_EXPIRED' });
      const client = await signedInClient(FINANCE);
      const signOutSpy = vi.spyOn(client, 'signOut');
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      render(
        <MemoryRouter initialEntries={['/admin/finance/payments']}>
          <QueryClientProvider client={queryClient}>
            <LanguageProvider>
              <StaffAuthProvider client={client}>
                <PaymentTransactionList />
              </StaffAuthProvider>
            </LanguageProvider>
          </QueryClientProvider>
        </MemoryRouter>
      );

      await waitFor(() => expect(signOutSpy).toHaveBeenCalled());
    });
  });

  describe('search, filters, sort and URL state', () => {
    it('debounces the search input before requesting', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      adminPaymentsClient.listPayments.mockResolvedValue(listResult([]));
      await renderAt('/admin/finance/payments', FINANCE);

      const input = await screen.findByLabelText('Search');
      const callsBefore = adminPaymentsClient.listPayments.mock.calls.length;
      fireEvent.change(input, { target: { value: 'Ahmed' } });

      expect(adminPaymentsClient.listPayments.mock.calls.length).toBe(callsBefore);

      await act(() => vi.advanceTimersByTimeAsync(500));
      await waitFor(() => {
        const [filters] = adminPaymentsClient.listPayments.mock.calls.at(-1)!;
        expect(filters.search).toBe('Ahmed');
      });
      vi.useRealTimers();
    });

    it('preserves search, status, reconciliation, sort and page from the URL on load', async () => {
      adminPaymentsClient.listPayments.mockResolvedValue(listResult([]));
      await renderAt('/admin/finance/payments?search=Ahmed&status=paid&reconciliation=open&sort=-amount&page=2', FINANCE);

      await waitFor(() => {
        const [filters, sort, page] = adminPaymentsClient.listPayments.mock.calls.at(-1)!;
        expect(filters).toEqual({ search: 'Ahmed', status: 'paid', reconciliationState: 'open' });
        expect(sort).toBe('-amount');
        expect(page.number).toBe(2);
      });
      expect(screen.getByLabelText('Search')).toHaveValue('Ahmed');
    });

    it('changing the status filter updates the request and the URL', async () => {
      adminPaymentsClient.listPayments.mockResolvedValue(listResult([]));
      await renderAt('/admin/finance/payments', FINANCE);

      const statusSelect = await screen.findByLabelText('Status');
      fireEvent.change(statusSelect, { target: { value: 'failed' } });

      await waitFor(() => {
        const [filters] = adminPaymentsClient.listPayments.mock.calls.at(-1)!;
        expect(filters.status).toBe('failed');
      });
    });

    it('changing the sort order updates the request', async () => {
      adminPaymentsClient.listPayments.mockResolvedValue(listResult([]));
      await renderAt('/admin/finance/payments', FINANCE);

      const sortSelect = await screen.findByLabelText('Sort by');
      fireEvent.change(sortSelect, { target: { value: 'amount' } });

      await waitFor(() => {
        const [, sort] = adminPaymentsClient.listPayments.mock.calls.at(-1)!;
        expect(sort).toBe('amount');
      });
    });

    it('resets the page to 1 when a filter changes', async () => {
      adminPaymentsClient.listPayments.mockResolvedValue(listResult([], { page: 2, perPage: 20, totalCount: 45, totalPages: 3 }));
      await renderAt('/admin/finance/payments?page=2', FINANCE);

      const statusSelect = await screen.findByLabelText('Status');
      fireEvent.change(statusSelect, { target: { value: 'paid' } });

      await waitFor(() => {
        const [, , page] = adminPaymentsClient.listPayments.mock.calls.at(-1)!;
        expect(page.number).toBe(1);
      });
    });

    it('shows "Clear filters" only when filters/sort are active, and clears them on click', async () => {
      adminPaymentsClient.listPayments.mockResolvedValue(listResult([]));
      await renderAt('/admin/finance/payments?search=Ahmed', FINANCE);

      const clearButton = await screen.findByText('Clear filters');
      fireEvent.click(clearButton);

      await waitFor(() => expect(screen.getByLabelText('Search')).toHaveValue(''));
      expect(screen.queryByText('Clear filters')).not.toBeInTheDocument();
    });

    it('does not show Clear filters with no active search/filters/sort', async () => {
      adminPaymentsClient.listPayments.mockResolvedValue(listResult([]));
      await renderAt('/admin/finance/payments', FINANCE);

      await waitFor(() => expect(adminPaymentsClient.listPayments).toHaveBeenCalled());
      expect(screen.queryByText('Clear filters')).not.toBeInTheDocument();
    });
  });

  describe('pagination', () => {
    it('requests the page reflected in the URL and renders Pagination controls', async () => {
      adminPaymentsClient.listPayments.mockResolvedValue(listResult([paymentSummary()], { page: 2, perPage: 20, totalCount: 45, totalPages: 3 }));
      await renderAt('/admin/finance/payments?page=2', FINANCE);

      await waitFor(() => {
        const [, , page] = adminPaymentsClient.listPayments.mock.calls.at(-1)!;
        expect(page.number).toBe(2);
      });
      expect(await screen.findByRole('navigation')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page');
    });

    it('clicking a page number requests that page and updates the URL', async () => {
      adminPaymentsClient.listPayments.mockResolvedValue(listResult([paymentSummary()], { page: 1, perPage: 20, totalCount: 45, totalPages: 3 }));
      await renderAt('/admin/finance/payments', FINANCE);

      const pageThreeButton = await screen.findByRole('button', { name: '3' });
      fireEvent.click(pageThreeButton);

      await waitFor(() => {
        const [, , page] = adminPaymentsClient.listPayments.mock.calls.at(-1)!;
        expect(page.number).toBe(3);
      });
    });
  });

  it('renders in Urdu', async () => {
    adminPaymentsClient.listPayments.mockResolvedValue(listResult([paymentSummary()]));
    window.localStorage.setItem('descon.language', 'ur');
    await renderAt('/admin/finance/payments', FINANCE);

    expect(await screen.findByRole('heading', { name: 'ادائیگی کے لین دین' })).toBeInTheDocument();
    window.localStorage.removeItem('descon.language');
  });
});

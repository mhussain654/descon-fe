import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from '../../../../../../shared/auth/staffAuthClient';
import { LanguageProvider } from '../../../../contexts/LanguageContext';
import { StaffAuthProvider } from '../../../../contexts/StaffAuthContext';
import { adminBankDetailsClient } from '../../../../lib/admin-bank-details-client';
import { BankDetailReviewCard } from './BankDetailReviewCard';

vi.mock('../../../../lib/admin-bank-details-client', () => ({
  adminBankDetailsClient: { get: vi.fn(), requestProofAccess: vi.fn(), verify: vi.fn(), reject: vi.fn() },
}));

const FINANCE = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'finance')!;
const HR = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'hr' && !account.locked && !account.suspended)!;

function bankDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bank-1',
    status: 'submitted' as const,
    accountTitle: 'Ahmed Ali',
    accountNumber: 'PK36SCBL0000001123456702',
    bankName: 'Meezan Bank',
    proof: { fileName: 'cheque.pdf', contentType: 'application/pdf', fileSize: 2048 },
    submittedAt: '2026-11-05T07:00:00Z',
    ...overrides,
  };
}

async function renderCard(account: { email: string }) {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: account.email, password: MOCK_STAFF_PASSWORD });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <StaffAuthProvider client={client}>
          <BankDetailReviewCard candidateId="candidate-1" />
        </StaffAuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

describe('BankDetailReviewCard', () => {
  afterEach(() => {
    Object.values(adminBankDetailsClient).forEach((fn) => vi.mocked(fn).mockReset());
    sessionStorage.clear();
  });

  it('shows the bank details awaiting review with Preview, Verify and Reject to staff who manage payments', async () => {
    vi.mocked(adminBankDetailsClient.get).mockResolvedValue(bankDetail());
    await renderCard(FINANCE);

    expect(await screen.findByText('PK36SCBL0000001123456702')).toBeInTheDocument();
    expect(screen.getByText('Ahmed Ali')).toBeInTheDocument();
    expect(screen.getByText('Pending review')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verify' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('verifies after confirming', async () => {
    vi.mocked(adminBankDetailsClient.get).mockResolvedValue(bankDetail());
    vi.mocked(adminBankDetailsClient.verify).mockResolvedValue(bankDetail({ status: 'verified', reviewedAt: '2026-11-05T08:00:00Z' }));
    await renderCard(FINANCE);

    fireEvent.click(await screen.findByRole('button', { name: 'Verify' }));
    await screen.findByText('Verify these bank details?');
    const confirmButtons = screen.getAllByRole('button', { name: 'Verify' });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(adminBankDetailsClient.verify).toHaveBeenCalledWith('candidate-1', expect.stringMatching(/^admin-bank-detail-verified-/)));
    expect(await screen.findByText('Verified')).toBeInTheDocument();
  });

  it('rejects with the reason typed', async () => {
    vi.mocked(adminBankDetailsClient.get).mockResolvedValue(bankDetail());
    vi.mocked(adminBankDetailsClient.reject).mockResolvedValue(
      bankDetail({ status: 'rejected', rejectionReason: 'The IBAN does not match the cheque.' })
    );
    await renderCard(FINANCE);

    fireEvent.click(await screen.findByRole('button', { name: 'Reject' }));
    fireEvent.change(await screen.findByLabelText('Reason'), { target: { value: ' The IBAN does not match the cheque. ' } });
    const rejectButtons = screen.getAllByRole('button', { name: 'Reject' });
    fireEvent.click(rejectButtons[rejectButtons.length - 1]);

    await waitFor(() =>
      expect(adminBankDetailsClient.reject).toHaveBeenCalledWith('candidate-1', 'The IBAN does not match the cheque.', expect.any(String))
    );
    expect(await screen.findByText(/The IBAN does not match the cheque\./)).toBeInTheDocument();
  });

  it('says when the candidate has not added bank details', async () => {
    vi.mocked(adminBankDetailsClient.get).mockResolvedValue(null);
    await renderCard(FINANCE);

    expect(await screen.findByText('The candidate has not added bank details yet.')).toBeInTheDocument();
  });

  it('tells reviewers without payments access that Finance reviews the bank details, without loading them', async () => {
    await renderCard(HR);

    expect(await screen.findByText(/reviewed by staff with payments access/)).toBeInTheDocument();
    expect(adminBankDetailsClient.get).not.toHaveBeenCalled();
  });
});

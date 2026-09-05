import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from '../../../../../../shared/auth/staffAuthClient';
import { LanguageProvider } from '../../../../contexts/LanguageContext';
import { StaffAuthProvider } from '../../../../contexts/StaffAuthContext';
import { adminDashboardClient } from '../../../../lib/admin-dashboard-client';
import { AdminDashboard } from './AdminDashboard';

vi.mock('../../../../lib/admin-dashboard-client', () => ({
  adminDashboardClient: { getDashboard: vi.fn() },
}));

const ADMIN = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'admin')!;
const HR = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'hr')!;

async function renderAs(account: typeof ADMIN) {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: account.email, password: MOCK_STAFF_PASSWORD });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <StaffAuthProvider client={client}>
          <AdminDashboard />
        </StaffAuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

describe('AdminDashboard', () => {
  afterEach(() => {
    vi.mocked(adminDashboardClient.getDashboard).mockReset();
  });

  it('renders the candidate workload, workflow queue, document review queue and payment summary', async () => {
    adminDashboardClient.getDashboard.mockResolvedValue({
      candidateWorkload: { totalActiveCandidates: 128 },
      workflowStageQueue: [{ code: 'registered', position: 1, count: 12 }],
      documentReviewQueue: { pendingReview: 6, verified: 90, rejected: 3, expiredPcc: 1, nearExpiryPcc: 2 },
      paymentSummary: [{ code: 'paid', count: 88 }],
    });

    await renderAs(ADMIN);

    expect(await screen.findByText('128')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('88')).toBeInTheDocument();
  });

  it('shows the FORBIDDEN state for a staff member without view_admin_dashboard', async () => {
    adminDashboardClient.getDashboard.mockRejectedValue({ code: 'FORBIDDEN' });

    await renderAs(HR);

    expect(await screen.findByText('Access restricted')).toBeInTheDocument();
  });
});

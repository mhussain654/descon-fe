import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from '../../../../../../shared/auth/staffAuthClient';
import { LanguageProvider } from '../../../../contexts/LanguageContext';
import { StaffAuthProvider } from '../../../../contexts/StaffAuthContext';
import { adminManagementDashboardClient } from '../../../../lib/admin-management-dashboard-client';
import { ManagementDashboard } from './ManagementDashboard';

vi.mock('../../../../lib/admin-management-dashboard-client', () => ({
  adminManagementDashboardClient: { getDashboard: vi.fn() },
}));

const MANAGEMENT = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'management')!;
const HR = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'hr')!;

function summary() {
  return {
    conversionFunnel: [{ code: 'verified', count: 80, percentage: 72.0 }],
    outcomeTracking: { rejectedDocuments: 6, qvcReMedical: 2, qvcRejected: 1, qvcNoShow: 3, visaRejected: 1 },
    mobilization: {
      byCountry: [{ code: 'qa', name: 'Qatar', count: 15 }],
      byProject: [{ code: 'proj-1', name: 'Project One', count: 15 }],
    },
    mobilizationTrend: [{ period: '2026-06-01', count: 15 }],
  };
}

async function renderAs(account: typeof MANAGEMENT) {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: account.email, password: MOCK_STAFF_PASSWORD });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <StaffAuthProvider client={client}>
          <ManagementDashboard />
        </StaffAuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

describe('ManagementDashboard', () => {
  afterEach(() => {
    vi.mocked(adminManagementDashboardClient.getDashboard).mockReset();
  });

  it('renders the conversion funnel, outcome tracking, mobilization and trend sections', async () => {
    adminManagementDashboardClient.getDashboard.mockResolvedValue(summary());

    await renderAs(MANAGEMENT);

    expect(await screen.findByText('72%')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('Qatar')).toBeInTheDocument();
    expect(screen.getByText('2026-06-01')).toBeInTheDocument();
  });

  it('re-fetches with the selected granularity', async () => {
    adminManagementDashboardClient.getDashboard.mockResolvedValue(summary());

    await renderAs(MANAGEMENT);
    await screen.findByText('72%');

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'daily' } });

    await waitFor(() => expect(adminManagementDashboardClient.getDashboard).toHaveBeenCalledWith('daily'));
  });

  it('shows the FORBIDDEN state for a staff member without view_management_dashboard', async () => {
    adminManagementDashboardClient.getDashboard.mockRejectedValue({ code: 'FORBIDDEN' });

    await renderAs(HR);

    expect(await screen.findByText('Access restricted')).toBeInTheDocument();
  });
});

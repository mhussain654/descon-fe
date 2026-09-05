import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from '../../../../../../shared/auth/staffAuthClient';
import { LanguageProvider } from '../../../../contexts/LanguageContext';
import { StaffAuthProvider } from '../../../../contexts/StaffAuthContext';
import { adminMpsDashboardClient } from '../../../../lib/admin-mps-dashboard-client';
import { MpsDashboard } from './MpsDashboard';

vi.mock('../../../../lib/admin-mps-dashboard-client', () => ({
  adminMpsDashboardClient: { getDashboard: vi.fn() },
}));

const MPS = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'mps')!;
const HR = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'hr')!;

function summary() {
  return {
    workflowStageQueue: [{ code: 'registered', position: 1, count: 12 }],
    delayedCases: { delayed: 9, critical: 2 },
    craftSummary: [{ code: 'electrician', name: 'Electrician', total: 40, mobilized: 15 }],
    mobilization: {
      byCountry: [{ code: 'qa', name: 'Qatar', count: 15 }],
      byProject: [{ code: 'proj-1', name: 'Project One', count: 15 }],
    },
    mobilizationTrend: [{ period: '2026-06-01', count: 15 }],
  };
}

async function renderAs(account: typeof MPS) {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: account.email, password: MOCK_STAFF_PASSWORD });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <StaffAuthProvider client={client}>
          <MpsDashboard />
        </StaffAuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

describe('MpsDashboard', () => {
  afterEach(() => {
    vi.mocked(adminMpsDashboardClient.getDashboard).mockReset();
  });

  it('renders the workflow queue, delayed cases, craft summary, mobilization and trend sections', async () => {
    adminMpsDashboardClient.getDashboard.mockResolvedValue(summary());

    await renderAs(MPS);

    expect(await screen.findByText('9')).toBeInTheDocument();
    expect(screen.getByText('Electrician')).toBeInTheDocument();
    expect(screen.getByText('Qatar')).toBeInTheDocument();
    expect(screen.getByText('Project One')).toBeInTheDocument();
    expect(screen.getByText('2026-06-01')).toBeInTheDocument();
  });

  it('re-fetches with the selected granularity', async () => {
    adminMpsDashboardClient.getDashboard.mockResolvedValue(summary());

    await renderAs(MPS);
    await screen.findByText('9');

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'weekly' } });

    await waitFor(() => expect(adminMpsDashboardClient.getDashboard).toHaveBeenCalledWith('weekly'));
  });

  it('shows the FORBIDDEN state for a staff member without view_mps_dashboard', async () => {
    adminMpsDashboardClient.getDashboard.mockRejectedValue({ code: 'FORBIDDEN' });

    await renderAs(HR);

    expect(await screen.findByText('Access restricted')).toBeInTheDocument();
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from '../../../../../../shared/auth/staffAuthClient';
import { LanguageProvider } from '../../../../contexts/LanguageContext';
import { StaffAuthProvider } from '../../../../contexts/StaffAuthContext';
import { adminMpsDashboardClient } from '../../../../lib/admin-mps-dashboard-client';
import { adminCandidateClient } from '../../../../lib/admin-candidates-client';
import type { MpsDashboardSummary } from '../../../../../../shared/adminMpsDashboard/types';
import { MpsDashboard } from './MpsDashboard';

vi.mock('../../../../lib/admin-mps-dashboard-client', () => ({
  adminMpsDashboardClient: { getDashboard: vi.fn() },
}));

vi.mock('../../../../lib/admin-candidates-client', () => ({
  adminCandidateClient: { getCountries: vi.fn(), getProjects: vi.fn(), getCrafts: vi.fn() },
}));

const MPS = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'mps')!;
const HR = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'hr')!;

function summary(overrides: Partial<MpsDashboardSummary> = {}): MpsDashboardSummary {
  return {
    workflowStageQueue: [
      { code: 'registered', position: 1, count: 12 },
      { code: 'documents_shared_with_qatar_bu', position: 8, count: 5 },
      { code: 'mobilized', position: 15, count: 3 },
    ],
    delayedCases: { delayed: 9, critical: 2 },
    craftSummary: [{ code: 'electrician', name: 'Electrician', total: 40, mobilized: 15 }],
    mobilization: {
      byCountry: [{ code: 'qa', name: 'Qatar', count: 15 }],
      byProject: [{ code: 'proj-1', name: 'Project One', count: 15 }],
    },
    mobilizationTrend: [{ period: '2026-06-01', count: 15 }],
    conversionFunnel: [
      { code: 'documents_uploaded', count: 10, percentage: 75 },
      { code: 'verified', count: 8, percentage: 60 },
      { code: 'mobilized', count: 3, percentage: 15 },
    ],
    latestMobilization: {
      candidateFullName: 'Ahmed Khan',
      candidatePublicId: 'candidate-1',
      candidateAssignmentPublicId: 'assignment-1',
      referenceNumber: 'REF-000123',
      countryName: 'Qatar',
      projectName: 'Project One',
      craftName: 'Electrician',
      mobilizedAt: '2026-09-01T09:48:00Z',
    },
    ...overrides,
  };
}

async function renderAs(account: typeof MPS) {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: account.email, password: MOCK_STAFF_PASSWORD });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <StaffAuthProvider client={client}>
            <MpsDashboard />
          </StaffAuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('MpsDashboard', () => {
  beforeEach(() => {
    vi.mocked(adminCandidateClient.getCountries).mockResolvedValue([{ code: 'pk', name: 'Pakistan' }]);
    vi.mocked(adminCandidateClient.getProjects).mockResolvedValue([{ code: 'lng', name: 'LNG Expansion' }]);
    vi.mocked(adminCandidateClient.getCrafts).mockResolvedValue([{ code: 'welder', name: 'Welder' }]);
  });

  afterEach(() => {
    vi.mocked(adminMpsDashboardClient.getDashboard).mockReset();
    vi.mocked(adminCandidateClient.getCountries).mockReset();
    vi.mocked(adminCandidateClient.getProjects).mockReset();
    vi.mocked(adminCandidateClient.getCrafts).mockReset();
  });

  it('renders the key metrics, requires attention, workflow stage queue, craft summary, mobilization and trend sections', async () => {
    adminMpsDashboardClient.getDashboard.mockResolvedValue(summary());

    await renderAs(MPS);

    expect(await screen.findByText('QVC & visa stage')).toBeInTheDocument();
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Electrician').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Qatar').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Project One').length).toBeGreaterThan(0);
    expect(screen.getByText('Mobilization trend')).toBeInTheDocument();
  });

  it('shows the key-metrics KPI row (delayed/critical/QVC & visa stage/mobilized with rate)', async () => {
    adminMpsDashboardClient.getDashboard.mockResolvedValue(summary());

    const { container } = await renderAs(MPS);
    await screen.findByText('QVC & visa stage');

    expect(screen.getAllByText('Delayed (7+ days)').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Critical (14+ days)').length).toBeGreaterThan(0);
    expect(screen.getByText('QVC & visa stage')).toBeInTheDocument();
    expect(screen.getByText('15% mobilization rate')).toBeInTheDocument();

    const headings = [...container.querySelectorAll('h2')].map((heading) => heading.textContent);
    expect(headings.indexOf('Key metrics')).toBeLessThan(headings.indexOf('Workflow stage queue'));
    expect(headings.indexOf('Workflow stage queue')).toBeLessThan(headings.indexOf('Craft-wise summary'));
    expect(headings.indexOf('Craft-wise summary')).toBeLessThan(headings.indexOf('Mobilization mix'));
    expect(headings.indexOf('Mobilization mix')).toBeLessThan(headings.indexOf('Mobilization trend'));
  });

  it('shows a real, computed operational insight (critical count + pipeline concentration)', async () => {
    adminMpsDashboardClient.getDashboard.mockResolvedValue(summary());

    await renderAs(MPS);

    expect(await screen.findByText('Operational insight')).toBeInTheDocument();
    expect(screen.getByText('2 critical candidates need immediate follow-up; most pipeline volume is still concentrated in Registration.')).toBeInTheDocument();
  });

  it('shows the requires-attention panel with only the real critical/delayed counts', async () => {
    adminMpsDashboardClient.getDashboard.mockResolvedValue(summary());

    await renderAs(MPS);
    await screen.findByText('QVC & visa stage');

    expect(screen.getByText('No movement for 14+ days')).toBeInTheDocument();
    expect(screen.getByText('No movement for 7+ days')).toBeInTheDocument();
  });

  it('shows the document completion, verification conversion and mobilization rate footer stats', async () => {
    adminMpsDashboardClient.getDashboard.mockResolvedValue(summary());

    await renderAs(MPS);
    await screen.findByText('QVC & visa stage');

    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText(/Mobilization rate/)).toBeInTheDocument();
  });

  it('shows compact country and project mobilization rankings without duplicate tables', async () => {
    adminMpsDashboardClient.getDashboard.mockResolvedValue(summary());

    await renderAs(MPS);
    await screen.findByText('QVC & visa stage');

    expect(screen.getByText('Mobilization by country')).toBeInTheDocument();
    expect(screen.getByText('Mobilization by project')).toBeInTheDocument();
    expect(screen.getAllByText('Qatar')).toHaveLength(1);
    expect(screen.getAllByText('Project One')).toHaveLength(1);
  });

  it('shows the latest mobilization card with a link to the candidate', async () => {
    adminMpsDashboardClient.getDashboard.mockResolvedValue(summary());

    await renderAs(MPS);
    await screen.findByText('QVC & visa stage');

    expect(screen.getByText('Latest mobilization')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ahmed Khan' })).toHaveAttribute('href', '/admin/candidates/candidate-1');
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('shows the latest-mobilization empty state when nothing has been mobilized yet', async () => {
    adminMpsDashboardClient.getDashboard.mockResolvedValue(summary({ latestMobilization: null }));

    await renderAs(MPS);
    await screen.findByText('QVC & visa stage');

    expect(screen.getByText('No candidates mobilized yet')).toBeInTheDocument();
  });

  it('re-fetches with the selected granularity, preserving any active filters', async () => {
    adminMpsDashboardClient.getDashboard.mockResolvedValue(summary());

    await renderAs(MPS);
    await screen.findByText('QVC & visa stage');

    fireEvent.change(screen.getByLabelText('Granularity'), { target: { value: 'weekly' } });

    await waitFor(() =>
      expect(adminMpsDashboardClient.getDashboard).toHaveBeenCalledWith('weekly', {
        countryCode: undefined,
        projectCode: undefined,
        craftCode: undefined,
      })
    );
  });

  it('re-fetches scoped to the selected country/project/craft filters', async () => {
    adminMpsDashboardClient.getDashboard.mockResolvedValue(summary());

    await renderAs(MPS);
    await screen.findByText('QVC & visa stage');

    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'pk' } });

    await waitFor(() =>
      expect(adminMpsDashboardClient.getDashboard).toHaveBeenCalledWith('monthly', {
        countryCode: 'pk',
        projectCode: undefined,
        craftCode: undefined,
      })
    );
  });

  it('shows a bounded craft performance table with proportional bars and a full-report link', async () => {
    adminMpsDashboardClient.getDashboard.mockResolvedValue(summary());

    await renderAs(MPS);
    await screen.findByText('QVC & visa stage');

    expect(screen.getByText('Largest crafts by headcount')).toBeInTheDocument();
    expect(screen.getByText('Rate')).toBeInTheDocument();
    expect(screen.getByText('37.5%')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View full craft report' })).toHaveAttribute('href', '/admin/reports');
  });

  it('limits the dashboard craft ranking to eight rows', async () => {
    const craftSummary = Array.from({ length: 10 }, (_, index) => ({
      code: `craft-${index + 1}`,
      name: `Craft ${index + 1}`,
      total: 20 - index,
      mobilized: index === 0 ? 2 : 0,
    }));
    adminMpsDashboardClient.getDashboard.mockResolvedValue(summary({ craftSummary }));

    await renderAs(MPS);
    await screen.findByText('QVC & visa stage');

    expect(screen.getByText('Craft 8')).toBeInTheDocument();
    expect(screen.queryByText('Craft 9')).not.toBeInTheDocument();
  });

  it('shows an empty state when there is no craft data', async () => {
    adminMpsDashboardClient.getDashboard.mockResolvedValue(summary({ craftSummary: [] }));

    await renderAs(MPS);
    await screen.findByText('QVC & visa stage');

    expect(screen.getByText('Craft-wise summary')).toBeInTheDocument();
    expect(screen.getByText('Nothing to show yet')).toBeInTheDocument();
  });

  it('shows the FORBIDDEN state for a staff member without view_mps_dashboard', async () => {
    adminMpsDashboardClient.getDashboard.mockRejectedValue({ code: 'FORBIDDEN' });

    await renderAs(HR);

    expect(await screen.findByText('Access restricted')).toBeInTheDocument();
  });
});

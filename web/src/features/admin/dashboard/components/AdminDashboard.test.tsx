import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from '../../../../../../shared/auth/staffAuthClient';
import { LanguageProvider } from '../../../../contexts/LanguageContext';
import { StaffAuthProvider } from '../../../../contexts/StaffAuthContext';
import { adminDashboardClient } from '../../../../lib/admin-dashboard-client';
import { adminCandidateClient } from '../../../../lib/admin-candidates-client';
import type { AdminDashboardSummary } from '../../../../../../shared/adminDashboard/types';
import { AdminDashboard } from './AdminDashboard';

vi.mock('../../../../lib/admin-dashboard-client', () => ({
  adminDashboardClient: { getDashboard: vi.fn() },
}));

vi.mock('../../../../lib/admin-candidates-client', () => ({
  adminCandidateClient: { getCountries: vi.fn(), getProjects: vi.fn(), getCrafts: vi.fn() },
}));

const ADMIN = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'admin')!;
const HR = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'hr')!;

/** Full response shape (base fields the earlier, smaller test suite already asserted, plus every field added by the "full data-backed redesign" -- see the plan). Tests override only the fields they care about. */
function buildSummary(overrides: Partial<AdminDashboardSummary> = {}): AdminDashboardSummary {
  return {
    candidateWorkload: { totalActiveCandidates: 128 },
    workflowStageQueue: [
      { code: 'registered', position: 1, count: 12 },
      { code: 'mobilized', position: 15, count: 9 },
    ],
    documentReviewQueue: { pendingReview: 6, verified: 90, rejected: 3, expiredPcc: 1, nearExpiryPcc: 2 },
    paymentSummary: [{ code: 'paid', count: 88 }],
    conversionFunnel: [
      { code: 'documents_uploaded', count: 96, percentage: 75.0 },
      { code: 'verified', count: 90, percentage: 70.3 },
      { code: 'mobilized', count: 15, percentage: 11.7 },
    ],
    averageStageDurationDays: 4.2,
    requiresAttention: [
      { code: 'rejected_documents', count: 3 },
      { code: 'failed_payment', count: 1 },
      { code: 'overdue_qvc', count: 2 },
      { code: 'callback_required', count: 1 },
    ],
    upcomingActivities: [
      { type: 'qvc_appointment', occursOn: '2026-09-25', candidateAssignmentPublicId: 'assignment-1', referenceNumber: 'REF-000123' },
    ],
    recentlyUpdatedCandidates: [
      {
        candidateFullName: 'Ahmed Khan',
        candidatePublicId: 'candidate-1',
        candidateAssignmentPublicId: 'assignment-2',
        referenceNumber: 'REF-000456',
        workflowStageCode: 'under_verification',
        lastUpdatedAt: '2026-09-18T09:48:00Z',
      },
    ],
    kpiTrends: {
      activeCandidates: [{ date: '2026-09-18', count: 5 }],
      paidPayments: [{ date: '2026-09-18', count: 4 }],
      mobilized: [{ date: '2026-09-18', count: 2 }],
    },
    ...overrides,
  };
}

async function renderAs(account: typeof ADMIN) {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: account.email, password: MOCK_STAFF_PASSWORD });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <StaffAuthProvider client={client}>
            <AdminDashboard />
          </StaffAuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.mocked(adminCandidateClient.getCountries).mockResolvedValue([{ code: 'pk', name: 'Pakistan' }]);
    vi.mocked(adminCandidateClient.getProjects).mockResolvedValue([{ code: 'lng', name: 'LNG Expansion' }]);
    vi.mocked(adminCandidateClient.getCrafts).mockResolvedValue([{ code: 'welder', name: 'Welder' }]);
  });

  afterEach(() => {
    vi.mocked(adminDashboardClient.getDashboard).mockReset();
    vi.mocked(adminCandidateClient.getCountries).mockReset();
    vi.mocked(adminCandidateClient.getProjects).mockReset();
    vi.mocked(adminCandidateClient.getCrafts).mockReset();
  });

  it('renders the candidate workload, workflow queue, document review queue and payment summary', async () => {
    adminDashboardClient.getDashboard.mockResolvedValue(buildSummary());

    await renderAs(ADMIN);

    expect(await screen.findByText('128')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    // 88 (the paid count) legitimately appears twice -- once in the Key
    // metrics KPI row, once in the detailed Payment summary breakdown --
    // both reading the exact same paymentSummary value, not a duplicate bug.
    expect(screen.getAllByText('88').length).toBeGreaterThan(0);
  });

  it('gives each stat-tile card a subtitle clarifying what is being counted and its scope', async () => {
    adminDashboardClient.getDashboard.mockResolvedValue(buildSummary());

    await renderAs(ADMIN);
    await screen.findByText('128');

    expect(screen.getByText('Total documents per review status, across all candidates')).toBeInTheDocument();
    expect(screen.getByText('Total payments per status, across all candidates')).toBeInTheDocument();
    expect(screen.getByText('Candidates grouped by pipeline phase')).toBeInTheDocument();
  });

  it('shows the FORBIDDEN state for a staff member without view_admin_dashboard', async () => {
    adminDashboardClient.getDashboard.mockRejectedValue({ code: 'FORBIDDEN' });

    await renderAs(HR);

    expect(await screen.findByText('Access restricted')).toBeInTheDocument();
  });

  it('shows the average stage duration and the document/verification conversion footer', async () => {
    adminDashboardClient.getDashboard.mockResolvedValue(buildSummary());

    await renderAs(ADMIN);

    expect(await screen.findByText('4.2 days')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('70.3%')).toBeInTheDocument();
  });

  it('shows a null average stage duration as an em dash instead of crashing', async () => {
    adminDashboardClient.getDashboard.mockResolvedValue(buildSummary({ averageStageDurationDays: null }));

    await renderAs(ADMIN);

    expect(await screen.findByText('—')).toBeInTheDocument();
  });

  it('renders the requires-attention counts', async () => {
    adminDashboardClient.getDashboard.mockResolvedValue(buildSummary());

    await renderAs(ADMIN);

    expect(await screen.findByText('Rejected documents')).toBeInTheDocument();
    expect(screen.getByText('Overdue QVC appointments')).toBeInTheDocument();
    expect(screen.getByText('Callback required')).toBeInTheDocument();
  });

  it('shows the requires-attention empty state when every count is zero', async () => {
    adminDashboardClient.getDashboard.mockResolvedValue(
      buildSummary({
        requiresAttention: [
          { code: 'rejected_documents', count: 0 },
          { code: 'failed_payment', count: 0 },
          { code: 'overdue_qvc', count: 0 },
          { code: 'callback_required', count: 0 },
        ],
      })
    );

    await renderAs(ADMIN);

    expect(await screen.findByText('Nothing needs attention right now')).toBeInTheDocument();
  });

  it('renders upcoming activities and recently-updated candidates', async () => {
    adminDashboardClient.getDashboard.mockResolvedValue(buildSummary());

    await renderAs(ADMIN);

    expect(await screen.findByText('REF-000123')).toBeInTheDocument();
    expect(screen.getByText('Ahmed Khan')).toBeInTheDocument();
  });

  it('shows empty states for upcoming activities and recently-updated candidates when there is no data', async () => {
    adminDashboardClient.getDashboard.mockResolvedValue(buildSummary({ upcomingActivities: [], recentlyUpdatedCandidates: [] }));

    await renderAs(ADMIN);

    expect(await screen.findByText('No upcoming activities in the next 7 days')).toBeInTheDocument();
    expect(screen.getByText('No recent stage changes yet')).toBeInTheDocument();
  });

  it('shows a next-action hint and a colored badge for each recently-updated candidate’s stage', async () => {
    adminDashboardClient.getDashboard.mockResolvedValue(buildSummary());

    await renderAs(ADMIN);

    expect(await screen.findByText('Continue verification')).toBeInTheDocument();
    expect(screen.getByText('Under Verification')).toBeInTheDocument();
  });

  it('re-fetches the dashboard scoped to the selected country/project/craft filters', async () => {
    adminDashboardClient.getDashboard.mockResolvedValue(buildSummary());

    await renderAs(ADMIN);
    await screen.findByText('128');

    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'pk' } });

    await screen.findByText('128');
    const lastCall = adminDashboardClient.getDashboard.mock.calls.at(-1)?.[0];
    expect(lastCall).toEqual({ countryCode: 'pk', projectCode: undefined, craftCode: undefined });
  });

  it('links each section header to its full page', async () => {
    adminDashboardClient.getDashboard.mockResolvedValue(buildSummary());

    await renderAs(ADMIN);
    await screen.findByText('128');

    expect(screen.getByRole('link', { name: 'Review queue' })).toHaveAttribute('href', '/admin/document-reviews');
    expect(screen.getByRole('link', { name: 'Transactions' })).toHaveAttribute('href', '/admin/finance/payments');
    expect(screen.getByRole('link', { name: 'View all candidates' })).toHaveAttribute('href', '/admin');
  });

  it('shows a real, computed operational insight highlighting the largest requires-attention exception', async () => {
    adminDashboardClient.getDashboard.mockResolvedValue(buildSummary());

    await renderAs(ADMIN);

    expect(await screen.findByText('Operational insight')).toBeInTheDocument();
    expect(screen.getByText('3 rejected documents — Review and notify candidates.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Review now' })).toHaveAttribute('href', '/admin/document-reviews?status=rejected');
  });

  it('falls back the insight to the real verification rate when nothing needs attention', async () => {
    adminDashboardClient.getDashboard.mockResolvedValue(
      buildSummary({
        requiresAttention: [
          { code: 'rejected_documents', count: 0 },
          { code: 'failed_payment', count: 0 },
          { code: 'overdue_qvc', count: 0 },
          { code: 'callback_required', count: 0 },
        ],
      })
    );

    await renderAs(ADMIN);

    expect(await screen.findByText('70.3% of candidates have completed verification.')).toBeInTheDocument();
  });
});

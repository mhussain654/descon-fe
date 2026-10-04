import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from '../../../../../../shared/auth/staffAuthClient';
import { LanguageProvider } from '../../../../contexts/LanguageContext';
import { StaffAuthProvider } from '../../../../contexts/StaffAuthContext';
import { adminReportsClient } from '../../../../lib/admin-reports-client';
import { triggerBlobDownload } from '../triggerBlobDownload';
import { ReportsWorkspace } from './ReportsWorkspace';

vi.mock('../../../../lib/admin-reports-client', () => ({
  adminReportsClient: { listReportTypes: vi.fn(), getReportData: vi.fn(), exportReport: vi.fn() },
}));

vi.mock('../triggerBlobDownload', () => ({
  triggerBlobDownload: vi.fn(),
}));

const MPS = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'mps')!;
const HR = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'hr')!;

async function signedInClient(account: typeof MPS) {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: account.email, password: MOCK_STAFF_PASSWORD });
  return client;
}

async function renderAs(account: typeof MPS) {
  const client = await signedInClient(account);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <StaffAuthProvider client={client}>
          <ReportsWorkspace />
        </StaffAuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

describe('ReportsWorkspace', () => {
  afterEach(() => {
    vi.mocked(adminReportsClient.listReportTypes).mockReset();
    vi.mocked(adminReportsClient.getReportData).mockReset();
    vi.mocked(adminReportsClient.exportReport).mockReset();
    vi.mocked(triggerBlobDownload).mockReset();
  });

  it('loads the catalogue and switches the default status report from chart to table', async () => {
    adminReportsClient.listReportTypes.mockResolvedValue([
      'status_summary',
      'mobilization',
      'craft_summary',
      'outcome_tracking',
      'conversion',
      'trend',
    ]);
    adminReportsClient.getReportData.mockResolvedValue({
      type: 'status_summary',
      rows: [{ code: 'registered', position: 1, count: 12 }],
    });

    await renderAs(MPS);

    expect(await screen.findByText('12')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Chart' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
    expect(screen.getByRole('tab', { name: 'Table' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('columnheader', { name: 'Stage' })).toBeInTheDocument();
  });

  it('switches to the mobilization report and renders both country and project tables', async () => {
    adminReportsClient.listReportTypes.mockResolvedValue(['status_summary', 'mobilization']);
    adminReportsClient.getReportData.mockImplementation(async (reportType) => {
      if (reportType === 'mobilization') {
        return {
          type: 'mobilization',
          summary: {
            byCountry: [{ code: 'qa', name: 'Qatar', count: 5 }],
            byProject: [{ code: 'p1', name: 'Project One', count: 5 }],
          },
        };
      }
      return { type: 'status_summary', rows: [] };
    });

    await renderAs(MPS);
    await screen.findByRole('combobox', { name: 'Report' });

    fireEvent.change(screen.getByRole('combobox', { name: 'Report' }), { target: { value: 'mobilization' } });

    expect(await screen.findByText('Qatar')).toBeInTheDocument();
    expect(screen.getByText('Project One')).toBeInTheDocument();
  });

  it('shows a granularity selector only for the trend report and passes it through to the query', async () => {
    adminReportsClient.listReportTypes.mockResolvedValue(['status_summary', 'trend']);
    adminReportsClient.getReportData.mockResolvedValue({ type: 'trend', rows: [{ period: '2026-06-01', count: 3 }] });

    await renderAs(MPS);
    await screen.findByRole('combobox', { name: 'Report' });

    expect(screen.queryByRole('combobox', { name: 'Granularity' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Report' }), { target: { value: 'trend' } });

    await screen.findByRole('combobox', { name: 'Granularity' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Granularity' }), { target: { value: 'weekly' } });

    await waitFor(() => expect(adminReportsClient.getReportData).toHaveBeenCalledWith('trend', { granularity: 'weekly' }));
  });

  it('exports the current report when an export button is clicked', async () => {
    adminReportsClient.listReportTypes.mockResolvedValue(['status_summary']);
    adminReportsClient.getReportData.mockResolvedValue({ type: 'status_summary', rows: [] });
    adminReportsClient.exportReport.mockResolvedValue({ blob: new Blob(['x']), filename: 'status_summary.csv' });

    await renderAs(MPS);
    await screen.findByRole('combobox', { name: 'Report' });

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    await waitFor(() => expect(adminReportsClient.exportReport).toHaveBeenCalledWith('status_summary', 'csv', undefined));
    await waitFor(() => expect(triggerBlobDownload).toHaveBeenCalledWith(expect.any(Blob), 'status_summary.csv'));
  });

  it('hides empty stages in both views without changing the export request', async () => {
    adminReportsClient.listReportTypes.mockResolvedValue(['status_summary']);
    adminReportsClient.getReportData.mockResolvedValue({ type: 'status_summary', rows: [{ code: 'registered', position: 1, count: 0 }, { code: 'mobilized', position: 15, count: 7 }] });
    adminReportsClient.exportReport.mockResolvedValue({ blob: new Blob(['full report']), filename: 'status_summary.csv' });
    await renderAs(MPS);
    await screen.findByText('7');
    expect(screen.queryByText('Registered')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
    expect(screen.queryByText('Registered')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show empty stages' }));
    expect(screen.getByText('Registered')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    await waitFor(() => expect(adminReportsClient.exportReport).toHaveBeenCalledWith('status_summary', 'csv', undefined));
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Table' }), { key: 'Home' });
    expect(screen.getByRole('tab', { name: 'Chart' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Chart' })).toHaveAttribute('aria-selected', 'true');
  });

  it('renders localized controls and an all-empty report in Urdu', async () => {
    localStorage.setItem('descon.language', 'ur');
    try {
      adminReportsClient.listReportTypes.mockResolvedValue(['status_summary']);
      adminReportsClient.getReportData.mockResolvedValue({ type: 'status_summary', rows: [{ code: 'registered', position: 1, count: 0 }] });
      await renderAs(MPS);
      const title = await screen.findByRole('heading', { level: 1, name: 'رپورٹس اور تجزیات' });
      expect(title.closest('[dir]')).toHaveAttribute('dir', 'rtl');
      await waitFor(() => expect(adminReportsClient.getReportData).toHaveBeenCalled());
      fireEvent.click(screen.getByRole('tab', { name: 'جدول' }));
      fireEvent.click(screen.getByRole('checkbox', { name: 'خالی مراحل دکھائیں' }));
      await screen.findByText('0');
    } finally { localStorage.removeItem('descon.language'); }
  });

  it('shows the FORBIDDEN state for a staff member without view_reports', async () => {
    adminReportsClient.listReportTypes.mockRejectedValue({ code: 'FORBIDDEN' });
    adminReportsClient.getReportData.mockRejectedValue({ code: 'FORBIDDEN' });

    await renderAs(HR);

    expect(await screen.findByText('Access restricted')).toBeInTheDocument();
  });
});

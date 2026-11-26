import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from '../../../../../../shared/auth/staffAuthClient';
import { LanguageProvider } from '../../../../contexts/LanguageContext';
import { StaffAuthProvider } from '../../../../contexts/StaffAuthContext';
import { adminCampaignClient } from '../../../../lib/admin-campaigns-client';
import { adminCandidateClient } from '../../../../lib/admin-candidates-client';
import { useDefaultCampaign } from '../hooks/useCampaigns';
import { CampaignSelectField } from './CampaignSelectField';
import { RunningCampaignBadge, RunningCampaignPicker } from './RunningCampaign';

vi.mock('../../../../lib/admin-campaigns-client', () => ({
  adminCampaignClient: { listCampaigns: vi.fn(), createCampaign: vi.fn(), getRunningCampaign: vi.fn(), setRunningCampaign: vi.fn() },
}));
vi.mock('../../../../lib/admin-candidates-client', () => ({
  adminCandidateClient: { getCountries: vi.fn() },
}));

const QATAR = {
  id: 'campaign-qatar', code: '2026-11-26-QATAR', name: 'Quarterly payment', kind: 'regular' as const,
  country: { code: 'qatar', name: 'Qatar' }, active: true, createdAt: '2026-11-26T00:00:00Z', candidateCount: 42,
};
const TEST = { id: 'campaign-test', code: 'TEST', name: 'Test campaign', kind: 'test' as const, country: null, active: true, createdAt: '2026-11-26T00:00:00Z', candidateCount: 1 };

const FINANCE = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'finance' && !account.locked && !account.suspended)!;

async function providers() {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: FINANCE.email, password: MOCK_STAFF_PASSWORD });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Providers({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <StaffAuthProvider client={client}>{children}</StaffAuthProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );
  };
}

async function renderWithStaff(ui: ReactNode) {
  const Providers = await providers();
  return render(<Providers>{ui}</Providers>);
}

describe('campaigns', () => {
  beforeEach(() => {
    vi.mocked(adminCampaignClient.listCampaigns).mockResolvedValue([TEST, QATAR]);
    vi.mocked(adminCandidateClient.getCountries).mockResolvedValue([{ code: 'qatar', name: 'Qatar' }]);
  });

  afterEach(() => {
    vi.mocked(adminCampaignClient.getRunningCampaign).mockReset();
    vi.mocked(adminCampaignClient.setRunningCampaign).mockReset();
    vi.mocked(adminCampaignClient.createCampaign).mockReset();
  });

  describe('running campaign', () => {
    it('shows All campaigns in the header switch while nothing is picked', async () => {
      vi.mocked(adminCampaignClient.getRunningCampaign).mockResolvedValue(null);

      await renderWithStaff(<RunningCampaignBadge />);

      expect(await screen.findByRole('link', { name: 'Change campaign' })).toHaveTextContent('All campaigns');
    });

    it('saves a picked campaign from the profile and shows it in the header switch', async () => {
      vi.mocked(adminCampaignClient.getRunningCampaign).mockResolvedValue(null);
      vi.mocked(adminCampaignClient.setRunningCampaign).mockResolvedValue(QATAR);

      await renderWithStaff(
        <>
          <RunningCampaignPicker />
          <RunningCampaignBadge />
        </>
      );

      await screen.findByRole('option', { name: /Quarterly payment \(2026-11-26-QATAR\) · 42 candidates/ });
      fireEvent.change(screen.getByLabelText('Campaign'), { target: { value: 'campaign-qatar' } });

      await waitFor(() => expect(adminCampaignClient.setRunningCampaign).toHaveBeenCalledWith('campaign-qatar'));
      await waitFor(() =>
        expect(screen.getByRole('link', { name: 'Change campaign' })).toHaveTextContent('Quarterly payment (2026-11-26-QATAR)')
      );
    });

    it('goes back to all campaigns with null', async () => {
      vi.mocked(adminCampaignClient.getRunningCampaign).mockResolvedValue(QATAR);
      vi.mocked(adminCampaignClient.setRunningCampaign).mockResolvedValue(null);

      await renderWithStaff(<RunningCampaignPicker />);
      const select = await screen.findByLabelText('Campaign');
      await waitFor(() => expect(select).toHaveValue('campaign-qatar'));
      fireEvent.change(select, { target: { value: '' } });

      await waitFor(() => expect(adminCampaignClient.setRunningCampaign).toHaveBeenCalledWith(null));
    });

    it("shows the server's message when saving fails", async () => {
      vi.mocked(adminCampaignClient.getRunningCampaign).mockResolvedValue(null);
      vi.mocked(adminCampaignClient.setRunningCampaign).mockRejectedValue({ code: 'VALIDATION_FAILED', message: 'Select a valid campaign.' });

      await renderWithStaff(<RunningCampaignPicker />);
      await screen.findByRole('option', { name: /Quarterly payment/ });
      fireEvent.change(screen.getByLabelText('Campaign'), { target: { value: 'campaign-qatar' } });

      expect(await screen.findByText('Select a valid campaign.')).toBeInTheDocument();
    });
  });

  describe('default campaign', () => {
    it('is the running campaign when one is picked', async () => {
      vi.mocked(adminCampaignClient.getRunningCampaign).mockResolvedValue(TEST);
      const { result } = renderHook(() => useDefaultCampaign(), { wrapper: await providers() });

      await waitFor(() => expect(result.current?.id).toBe('campaign-test'));
    });

    it('is the latest regular campaign otherwise', async () => {
      vi.mocked(adminCampaignClient.getRunningCampaign).mockResolvedValue(null);
      const { result } = renderHook(() => useDefaultCampaign(), { wrapper: await providers() });

      await waitFor(() => expect(result.current?.id).toBe('campaign-qatar'));
    });
  });

  describe('New campaign pop-up', () => {
    async function openDialog(onChange = vi.fn()) {
      vi.mocked(adminCampaignClient.getRunningCampaign).mockResolvedValue(null);
      await renderWithStaff(<CampaignSelectField value="" onChange={onChange} />);
      fireEvent.click(await screen.findByRole('button', { name: 'New campaign' }));
      return onChange;
    }

    it('asks for the name first and requires a name and country', async () => {
      await openDialog();

      const dialog = await screen.findByRole('dialog', { name: 'New campaign' });
      expect(dialog.querySelector('input')).toBe(screen.getByLabelText('Name'));
      fireEvent.click(screen.getByRole('button', { name: 'Create campaign' }));

      expect(await screen.findByText('Enter a name.')).toBeInTheDocument();
      expect(screen.getByText('Select a country.')).toBeInTheDocument();
      expect(adminCampaignClient.createCampaign).not.toHaveBeenCalled();
    });

    it('creates the campaign and picks it', async () => {
      const created = { ...QATAR, id: 'campaign-new', name: 'Final year plan' };
      vi.mocked(adminCampaignClient.createCampaign).mockResolvedValue(created);
      const onChange = await openDialog();
      await screen.findByRole('option', { name: 'Qatar' });

      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Final year plan' } });
      fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'qatar' } });
      fireEvent.click(screen.getByRole('button', { name: 'Create campaign' }));

      await waitFor(() => expect(onChange).toHaveBeenCalledWith(created));
      expect(adminCampaignClient.createCampaign).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Final year plan', countryCode: 'qatar' })
      );
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });
  });
});

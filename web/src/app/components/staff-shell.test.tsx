import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from '../../../../shared/auth/staffAuthClient';
import { LanguageProvider } from '../../contexts/LanguageContext';
import { StaffAuthProvider } from '../../contexts/StaffAuthContext';
import { StaffShell } from './staff-shell';

const FINANCE = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'finance' && !account.locked && !account.suspended)!;
const MANAGEMENT = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'management')!;
const HR = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'hr')!;

async function renderShellAs(account: typeof FINANCE) {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: account.email, password: MOCK_STAFF_PASSWORD });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <StaffAuthProvider client={client}>
            <StaffShell>
              <p>page content</p>
            </StaffShell>
          </StaffAuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('StaffShell navigation', () => {
  it('shows the Finance payments nav link for a staff member with manage_payments', async () => {
    await renderShellAs(FINANCE);

    expect(await screen.findByRole('link', { name: 'Finance payments' })).toHaveAttribute('href', '/admin/finance/payments');
  });

  it('shows the Finance payments nav link for a staff member with only view_payments', async () => {
    await renderShellAs(MANAGEMENT);

    expect(await screen.findByRole('link', { name: 'Finance payments' })).toBeInTheDocument();
  });

  it('never renders the Finance payments nav link for a staff member with neither permission', async () => {
    await renderShellAs(HR);

    expect(await screen.findByText('page content')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Finance payments' })).not.toBeInTheDocument();
  });

  it('shows the Audit log nav link for a staff member with view_audit_events', async () => {
    await renderShellAs(MANAGEMENT);

    expect(await screen.findByRole('link', { name: 'Audit log' })).toHaveAttribute('href', '/admin/audit-log');
  });

  it('never renders the Audit log nav link for a staff member without view_audit_events', async () => {
    await renderShellAs(FINANCE);

    expect(await screen.findByText('page content')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Audit log' })).not.toBeInTheDocument();
  });

  it('shows the Dashboard nav link for a staff member with view_admin_dashboard', async () => {
    const ADMIN = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'admin')!;
    await renderShellAs(ADMIN);

    expect(await screen.findByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/admin/dashboard');
  });

  it('shows the MPS Dashboard and Reports nav links for a staff member with view_mps_dashboard/view_reports', async () => {
    const MPS = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'mps')!;
    await renderShellAs(MPS);

    expect(await screen.findByRole('link', { name: 'MPS Dashboard' })).toHaveAttribute('href', '/admin/mps-dashboard');
    expect(screen.getByRole('link', { name: 'Reports' })).toHaveAttribute('href', '/admin/reports');
    expect(screen.queryByRole('link', { name: 'Management Dashboard' })).not.toBeInTheDocument();
  });

  it('shows the Management Dashboard nav link for a staff member with view_management_dashboard', async () => {
    await renderShellAs(MANAGEMENT);

    expect(await screen.findByRole('link', { name: 'Management Dashboard' })).toHaveAttribute('href', '/admin/management-dashboard');
  });

  it('never renders any dashboard/reports nav link for a staff member without those permissions', async () => {
    await renderShellAs(HR);

    expect(await screen.findByText('page content')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'MPS Dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Management Dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Reports' })).not.toBeInTheDocument();
  });
});

describe('StaffShell mobile navigation menu', () => {
  it('keeps the mobile nav closed (and its links out of the DOM) until the menu button is opened', async () => {
    const ADMIN = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'admin')!;
    await renderShellAs(ADMIN);
    await screen.findByText('page content');

    // Two "Candidates" links would exist once the drawer opens (desktop nav
    // + mobile drawer nav); while closed there must be exactly one.
    expect(screen.getAllByRole('link', { name: 'Candidates' })).toHaveLength(1);
    expect(screen.queryByRole('navigation', { name: 'Descon Staff Portal' })).toBeInTheDocument();
  });

  it('opens the mobile drawer on menu button click, exposing a second copy of the nav links', async () => {
    const ADMIN = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'admin')!;
    await renderShellAs(ADMIN);
    await screen.findByText('page content');

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));

    expect(screen.getAllByRole('link', { name: 'Candidates' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes the mobile drawer again on a second menu button click', async () => {
    const ADMIN = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'admin')!;
    await renderShellAs(ADMIN);
    await screen.findByText('page content');

    const toggle = screen.getByRole('button', { name: 'Menu' });
    fireEvent.click(toggle);
    fireEvent.click(toggle);

    expect(screen.getAllByRole('link', { name: 'Candidates' })).toHaveLength(1);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes the mobile drawer after clicking a nav link inside it', async () => {
    await renderShellAs(MANAGEMENT);
    await screen.findByText('page content');

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getAllByRole('link', { name: 'Reports' })).toHaveLength(2);

    const [, drawerLink] = screen.getAllByRole('link', { name: 'Reports' });
    fireEvent.click(drawerLink);

    expect(await screen.findAllByRole('link', { name: 'Reports' })).toHaveLength(1);
  });
});

import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from '../../../../shared/auth/staffAuthClient';
import { LanguageProvider } from '../../contexts/LanguageContext';
import { StaffAuthProvider } from '../../contexts/StaffAuthContext';
import { StaffShell } from './staff-shell';

const FINANCE = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'finance' && !account.locked && !account.suspended)!;
const MANAGEMENT = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'management')!;
const HR = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'hr' && !account.locked && !account.suspended)!;
const ADMIN = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'admin')!;
const MPS = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'mps')!;

async function renderShellAs(account: typeof FINANCE, initialEntries: string[] = ['/']) {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: account.email, password: MOCK_STAFF_PASSWORD });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={initialEntries}>
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

  it('shows the Training nav link inside the Administration group for a staff member with manage_training_settings', async () => {
    await renderShellAs(ADMIN);

    fireEvent.click(await screen.findByRole('button', { name: 'Administration' }));

    expect(await screen.findByRole('link', { name: 'Training' })).toHaveAttribute('href', '/admin/training-settings');
  });

  it('never renders the Training nav link for a staff member without manage_training_settings', async () => {
    await renderShellAs(MPS);

    expect(await screen.findByText('page content')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Administration' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Training' })).not.toBeInTheDocument();
  });

  it('shows the Audit log nav link inside the Administration group for a staff member with view_audit_events', async () => {
    await renderShellAs(MANAGEMENT);

    fireEvent.click(await screen.findByRole('button', { name: 'Administration' }));

    expect(await screen.findByRole('link', { name: 'Audit log' })).toHaveAttribute('href', '/admin/audit-log');
  });

  it('never renders the Administration group for a staff member with none of its permissions', async () => {
    await renderShellAs(FINANCE);

    expect(await screen.findByText('page content')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Administration' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Audit log' })).not.toBeInTheDocument();
  });

  it('shows the Dashboard nav link inside the Dashboards group for a staff member with view_admin_dashboard', async () => {
    await renderShellAs(ADMIN);

    fireEvent.click(await screen.findByRole('button', { name: 'Dashboards' }));

    expect(await screen.findByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/admin/dashboard');
  });

  it('shows the Operations Dashboard nav link (inside Dashboards) and the standalone Reports link for a staff member with view_mps_dashboard/view_reports', async () => {
    await renderShellAs(MPS);

    // Reports is a direct top-level link -- no dropdown to open for it.
    expect(await screen.findByRole('link', { name: 'Reports' })).toHaveAttribute('href', '/admin/reports');

    fireEvent.click(screen.getByRole('button', { name: 'Dashboards' }));

    expect(await screen.findByRole('link', { name: 'Operations Dashboard' })).toHaveAttribute('href', '/admin/mps-dashboard');
    expect(screen.queryByRole('link', { name: 'Management Dashboard' })).not.toBeInTheDocument();
  });

  it('shows the Management Dashboard nav link for a staff member with view_management_dashboard', async () => {
    await renderShellAs(MANAGEMENT);

    fireEvent.click(await screen.findByRole('button', { name: 'Dashboards' }));

    expect(await screen.findByRole('link', { name: 'Management Dashboard' })).toHaveAttribute(
      'href',
      '/admin/management-dashboard'
    );
  });

  it('never renders the Dashboards group or the standalone Reports link for a staff member without those permissions', async () => {
    await renderShellAs(HR);

    expect(await screen.findByText('page content')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dashboards' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Operations Dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Management Dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Reports' })).not.toBeInTheDocument();
  });
});

describe('StaffShell grouped nav dropdowns', () => {
  it('keeps a group collapsed (its links out of the DOM) until its toggle is clicked', async () => {
    await renderShellAs(ADMIN);
    await screen.findByText('page content');

    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dashboards' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes a group again on a second click of its own toggle', async () => {
    await renderShellAs(ADMIN);
    const toggle = await screen.findByRole('button', { name: 'Dashboards' });

    fireEvent.click(toggle);
    expect(await screen.findByRole('link', { name: 'Dashboard' })).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('switches to the other group when its toggle is clicked while a different group is open', async () => {
    await renderShellAs(ADMIN);
    fireEvent.click(await screen.findByRole('button', { name: 'Dashboards' }));
    expect(await screen.findByRole('link', { name: 'Dashboard' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Communications' }));

    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'AI call settings' })).toBeInTheDocument();
  });

  it('closes an open group on an outside click', async () => {
    await renderShellAs(ADMIN);
    fireEvent.click(await screen.findByRole('button', { name: 'Dashboards' }));
    expect(await screen.findByRole('link', { name: 'Dashboard' })).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
  });

  it('closes an open group on Escape', async () => {
    await renderShellAs(ADMIN);
    fireEvent.click(await screen.findByRole('button', { name: 'Dashboards' }));
    expect(await screen.findByRole('link', { name: 'Dashboard' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
  });

  it('closes the group after clicking one of its links', async () => {
    await renderShellAs(ADMIN);
    fireEvent.click(await screen.findByRole('button', { name: 'Dashboards' }));

    fireEvent.click(await screen.findByRole('link', { name: 'Dashboard' }));

    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dashboards' })).toHaveAttribute('aria-expanded', 'false');
  });

  it("highlights a group's toggle when the current route matches one of its (collapsed) children", async () => {
    await renderShellAs(MANAGEMENT, ['/admin/audit-log']);

    const toggle = await screen.findByRole('button', { name: 'Administration' });

    expect(toggle.className).toContain('bg-brand-subtle');
  });

  it("does not highlight a group's toggle while on an unrelated route", async () => {
    await renderShellAs(MANAGEMENT, ['/admin/finance/payments']);

    const toggle = await screen.findByRole('button', { name: 'Administration' });

    expect(toggle.className).not.toContain('bg-brand-subtle');
  });

  it('does not fall back to highlighting Candidates while on the account-menu-only /admin/profile route', async () => {
    await renderShellAs(ADMIN, ['/admin/profile']);

    const candidatesLink = await screen.findByRole('link', { name: 'Candidates' });

    expect(candidatesLink.className).not.toContain('bg-brand-subtle');
  });
});

describe('StaffShell branding', () => {
  it('shows "Descon Admin Portal" as the portal name', async () => {
    await renderShellAs(ADMIN);

    expect(await screen.findByText('Descon Admin Portal')).toBeInTheDocument();
  });
});

describe('StaffShell account menu', () => {
  it('keeps the account menu collapsed until its toggle is clicked, showing only the signed-in email', async () => {
    await renderShellAs(ADMIN);

    expect(await screen.findByRole('button', { name: ADMIN.email })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Profile' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
  });

  it('opens the account menu on click, showing the role and Profile/Sign out actions', async () => {
    await renderShellAs(ADMIN);

    fireEvent.click(await screen.findByRole('button', { name: ADMIN.email }));

    expect(await screen.findByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/admin/profile');
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('closes the account menu again on a second click of its own toggle', async () => {
    await renderShellAs(ADMIN);
    const toggle = await screen.findByRole('button', { name: ADMIN.email });

    fireEvent.click(toggle);
    expect(await screen.findByRole('link', { name: 'Profile' })).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.queryByRole('link', { name: 'Profile' })).not.toBeInTheDocument();
  });

  it('closes the account menu on an outside click', async () => {
    await renderShellAs(ADMIN);
    fireEvent.click(await screen.findByRole('button', { name: ADMIN.email }));
    expect(await screen.findByRole('link', { name: 'Profile' })).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('link', { name: 'Profile' })).not.toBeInTheDocument();
  });

  it('only ever has one desktop dropdown open at a time -- opening the account menu closes an open nav group', async () => {
    await renderShellAs(ADMIN);
    fireEvent.click(await screen.findByRole('button', { name: 'Dashboards' }));
    expect(await screen.findByRole('link', { name: 'Dashboard' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: ADMIN.email }));

    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Profile' })).toBeInTheDocument();
  });
});

describe('StaffShell mobile navigation menu', () => {
  it('keeps the mobile nav closed (and its links out of the DOM) until the menu button is opened', async () => {
    await renderShellAs(ADMIN);
    await screen.findByText('page content');

    // Two "Candidates" links would exist once the drawer opens (desktop nav
    // + mobile drawer nav); while closed there must be exactly one.
    expect(screen.getAllByRole('link', { name: 'Candidates' })).toHaveLength(1);
    expect(screen.queryByRole('navigation', { name: 'Descon Admin Portal' })).toBeInTheDocument();
  });

  it('opens the mobile drawer on menu button click, exposing a second copy of the nav links', async () => {
    await renderShellAs(ADMIN);
    await screen.findByText('page content');

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));

    expect(screen.getAllByRole('link', { name: 'Candidates' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes the mobile drawer again on a second menu button click', async () => {
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
    expect(screen.getAllByRole('link', { name: 'Finance payments' })).toHaveLength(2);

    const [, drawerLink] = screen.getAllByRole('link', { name: 'Finance payments' });
    fireEvent.click(drawerLink);

    expect(await screen.findAllByRole('link', { name: 'Finance payments' })).toHaveLength(1);
  });

  it('renders a grouped section inside the mobile drawer without needing a toggle', async () => {
    await renderShellAs(MANAGEMENT);
    await screen.findByText('page content');

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));

    // The mobile drawer lists every group's children directly under a
    // section heading -- no click needed, unlike the desktop dropdown. (The
    // desktop toggle button also renders the text "Administration", so the
    // heading assertion is scoped to the drawer itself.)
    expect(screen.getAllByRole('link', { name: 'Audit log' })).toHaveLength(1);
    const drawer = document.getElementById('staff-mobile-nav')!;
    expect(within(drawer).getAllByText('Administration')).toHaveLength(1);
  });
});

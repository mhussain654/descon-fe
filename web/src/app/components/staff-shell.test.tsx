import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from '../../../../shared/auth/staffAuthClient';
import { LanguageProvider } from '../../contexts/LanguageContext';
import { StaffAuthProvider } from '../../contexts/StaffAuthContext';
import { StaffShell } from './staff-shell';

const FINANCE = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'finance' && !account.locked && !account.suspended)!;
const MANAGEMENT = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'management')!;
const HR = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'hr' && !account.locked && !account.suspended)!;
const ADMIN = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'admin')!;
const MPS = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'mps')!;

beforeEach(() => {
  window.localStorage.removeItem('descon.admin.sidebar.collapsed');
});

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

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname + location.search}</div>;
}

/** Same as renderShellAs, plus a sibling that exposes the router's current location as text -- used only by the header search test, which needs to observe where the header's search form navigated to. */
async function renderShellWithLocationProbe(account: typeof FINANCE) {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: account.email, password: MOCK_STAFF_PASSWORD });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={['/admin/dashboard']}>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <StaffAuthProvider client={client}>
            <StaffShell>
              <p>page content</p>
            </StaffShell>
            <LocationProbe />
          </StaffAuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('StaffShell sidebar navigation', () => {
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

  it('shows the Training nav link under the Administration section for a staff member with manage_training_settings', async () => {
    await renderShellAs(ADMIN);

    expect(await screen.findByRole('link', { name: 'Training' })).toHaveAttribute('href', '/admin/training-settings');
  });

  it('never renders the Training nav link for a staff member without manage_training_settings', async () => {
    await renderShellAs(MPS);

    expect(await screen.findByText('page content')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Training' })).not.toBeInTheDocument();
  });

  it('shows the Audit log nav link under the Administration section for a staff member with view_audit_events', async () => {
    await renderShellAs(MANAGEMENT);

    expect(await screen.findByRole('link', { name: 'Audit log' })).toHaveAttribute('href', '/admin/audit-log');
  });

  it('never renders any Administration-section link for a staff member with none of its permissions', async () => {
    await renderShellAs(FINANCE);

    expect(await screen.findByText('page content')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Audit log' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Backups' })).not.toBeInTheDocument();
  });

  it('shows the Dashboard nav link under the Dashboards section for a staff member with view_admin_dashboard', async () => {
    await renderShellAs(ADMIN);

    expect(await screen.findByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/admin/dashboard');
  });

  it('shows the Operations Dashboard nav link (under Dashboards) and the standalone Reports link for a staff member with view_mps_dashboard/view_reports', async () => {
    await renderShellAs(MPS);

    expect(await screen.findByRole('link', { name: 'Reports' })).toHaveAttribute('href', '/admin/reports');
    expect(await screen.findByRole('link', { name: 'Operations Dashboard' })).toHaveAttribute('href', '/admin/mps-dashboard');
    expect(screen.queryByRole('link', { name: 'Management Dashboard' })).not.toBeInTheDocument();
  });

  it('shows the Management Dashboard nav link for a staff member with view_management_dashboard', async () => {
    await renderShellAs(MANAGEMENT);

    expect(await screen.findByRole('link', { name: 'Management Dashboard' })).toHaveAttribute(
      'href',
      '/admin/management-dashboard'
    );
  });

  it('never renders any Dashboards-section link or the standalone Reports link for a staff member without those permissions', async () => {
    await renderShellAs(HR);

    expect(await screen.findByText('page content')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Operations Dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Management Dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Reports' })).not.toBeInTheDocument();
  });

  it('renders every section fully expanded, with no click-to-expand toggle', async () => {
    await renderShellAs(ADMIN);

    // Every nav section (Dashboards, Communications, Administration) is fully
    // expanded in the sidebar at all times, with no text heading and no
    // group-toggle button to click, unlike the previous horizontal-dropdown
    // design -- its links (here, Dashboard and Training, from two different
    // sections) are immediately present with no click needed.
    expect(await screen.findByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Training' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dashboards' })).not.toBeInTheDocument();
  });

  it("highlights the active link's own href, not a separate group toggle", async () => {
    await renderShellAs(MANAGEMENT, ['/admin/audit-log']);

    const auditLogLink = await screen.findByRole('link', { name: 'Audit log' });

    expect(auditLogLink.className).toContain('text-brand-on');
  });

  it('does not highlight an inactive link while on an unrelated route', async () => {
    await renderShellAs(MANAGEMENT, ['/admin/finance/payments']);

    const auditLogLink = await screen.findByRole('link', { name: 'Audit log' });

    expect(auditLogLink.className).not.toContain('text-brand-on');
  });

  it('does not fall back to highlighting Candidates while on the account-menu-only /admin/profile route', async () => {
    await renderShellAs(ADMIN, ['/admin/profile']);

    const [candidatesLink] = await screen.findAllByRole('link', { name: 'Candidates' });

    expect(candidatesLink.className).not.toContain('text-brand-on');
  });
});

describe('StaffShell branding', () => {
  it('shows "Descon Admin Portal" as the portal name', async () => {
    await renderShellAs(ADMIN);

    expect((await screen.findAllByText('Descon Admin Portal')).length).toBeGreaterThan(0);
  });
});

describe('StaffShell desktop sidebar collapse', () => {
  it('collapses to an icon rail, keeps navigation accessible, and can expand again', async () => {
    const { container } = await renderShellAs(ADMIN, ['/admin/dashboard']);

    const collapseButton = await screen.findByRole('button', { name: 'Collapse sidebar' });
    fireEvent.click(collapseButton);

    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('title', 'Dashboard');
    expect(container.querySelector('main')).toHaveClass('lg:ms-16');
    expect(window.localStorage.getItem('descon.admin.sidebar.collapsed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));

    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    expect(container.querySelector('main')).toHaveClass('lg:ms-64');
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

  it('closes the account menu on Escape', async () => {
    await renderShellAs(ADMIN);
    fireEvent.click(await screen.findByRole('button', { name: ADMIN.email }));
    expect(await screen.findByRole('link', { name: 'Profile' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('link', { name: 'Profile' })).not.toBeInTheDocument();
  });
});

describe('StaffShell mobile navigation drawer', () => {
  it('keeps the mobile drawer closed (and its links out of the DOM) until the menu button is opened', async () => {
    await renderShellAs(ADMIN);
    await screen.findByText('page content');

    // Only the persistent desktop sidebar's copy of "Candidates" exists while
    // the mobile drawer is closed.
    expect(screen.getAllByRole('link', { name: 'Candidates' })).toHaveLength(1);
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

    const drawer = document.getElementById('staff-mobile-nav')!;
    expect(within(drawer).getByRole('link', { name: 'Audit log' })).toBeInTheDocument();
  });
});

describe('StaffShell top header', () => {
  it('submits the header search to the candidates list with the query as a URL param', async () => {
    await renderShellWithLocationProbe(ADMIN);
    await screen.findByText('page content');

    const searchInput = screen.getByRole('searchbox', { name: 'Search candidates' });
    fireEvent.change(searchInput, { target: { value: 'Ahmed Ali' } });
    fireEvent.submit(searchInput.closest('form')!);

    expect(screen.getByTestId('location-probe')).toHaveTextContent('/admin?search=Ahmed%20Ali');
  });

  it('submits an empty header search to the plain candidates list route', async () => {
    await renderShellWithLocationProbe(ADMIN);
    await screen.findByText('page content');

    fireEvent.submit(screen.getByRole('searchbox', { name: 'Search candidates' }).closest('form')!);

    expect(screen.getByTestId('location-probe')).toHaveTextContent('/admin');
  });

  it('toggles the theme via the header button, updating its own accessible name', async () => {
    await renderShellAs(ADMIN);
    await screen.findByText('page content');

    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }));

    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
  });

  it('exposes a header account-menu trigger distinct from the sidebar account-menu trigger', async () => {
    await renderShellAs(ADMIN);
    await screen.findByText('page content');

    expect(screen.getByRole('button', { name: ADMIN.email })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Account menu' })).toBeInTheDocument();
  });

  it('opens the header account menu independently of the sidebar one, showing Profile/Sign out', async () => {
    await renderShellAs(ADMIN);
    await screen.findByText('page content');

    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));

    expect(await screen.findAllByRole('link', { name: 'Profile' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Sign out' })).toHaveLength(1);
  });

  it('closes the header account menu on an outside click', async () => {
    await renderShellAs(ADMIN);
    await screen.findByText('page content');

    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(await screen.findByRole('link', { name: 'Profile' })).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('link', { name: 'Profile' })).not.toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
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
});

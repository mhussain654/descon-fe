import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from '../../../../shared/auth/staffAuthClient';
import { LanguageProvider } from '../../contexts/LanguageContext';
import { StaffAuthProvider } from '../../contexts/StaffAuthContext';
import { StaffProfile } from './StaffProfile';

const MANAGEMENT = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'management')!;

async function renderProfileAs(account: typeof MANAGEMENT) {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: account.email, password: MOCK_STAFF_PASSWORD });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <StaffAuthProvider client={client}>
            <StaffProfile />
          </StaffAuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('StaffProfile', () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it("shows the signed-in staff member's email and role", async () => {
    await renderProfileAs(MANAGEMENT);

    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.getAllByText(MANAGEMENT.email).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Management').length).toBeGreaterThan(0);
  });
});

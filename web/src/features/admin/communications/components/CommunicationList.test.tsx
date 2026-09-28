import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from '../../../../../../shared/auth/staffAuthClient';
import { LanguageProvider } from '../../../../contexts/LanguageContext';
import { StaffAuthProvider } from '../../../../contexts/StaffAuthContext';
import { adminCommunicationsClient } from '../../../../lib/admin-communications-client';
import { CommunicationList } from './CommunicationList';

vi.mock('../../../../lib/admin-communications-client', () => ({
  adminCommunicationsClient: { listCommunications: vi.fn() },
}));

const ADMIN = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'admin')!;
const FINANCE = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'finance' && !account.locked && !account.suspended)!;

async function signedInClient(account: typeof ADMIN) {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: account.email, password: MOCK_STAFF_PASSWORD });
  return client;
}

function communication(overrides: Record<string, unknown> = {}) {
  return {
    id: 'comm-1',
    channelCode: 'sms',
    directionCode: 'outbound' as const,
    statusCode: 'sent',
    locale: 'en',
    createdAt: '2026-09-06T10:00:00Z',
    ...overrides,
  };
}

function listResult(
  items: ReturnType<typeof communication>[],
  summary = [
    { code: 'inbound' as const, count: 0 },
    { code: 'outbound' as const, count: items.length },
  ]
) {
  return { items, pagination: { page: 1, perPage: 20, totalCount: items.length, totalPages: 1 }, appliedFilters: {}, summary };
}

async function renderAs(account: typeof ADMIN) {
  const client = await signedInClient(account);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <StaffAuthProvider client={client}>
            <CommunicationList />
          </StaffAuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('CommunicationList', () => {
  afterEach(() => {
    vi.mocked(adminCommunicationsClient.listCommunications).mockReset();
  });

  it('shows the real, table-wide direction summary from the backend, not a page-scoped approximation', async () => {
    adminCommunicationsClient.listCommunications.mockResolvedValue(
      listResult([communication()], [
        { code: 'inbound', count: 3 },
        { code: 'outbound', count: 12 },
      ])
    );

    await renderAs(ADMIN);

    expect(await screen.findAllByText('Outbound')).not.toHaveLength(0);
    expect(screen.getAllByText('Inbound')).not.toHaveLength(0);
    // 12 outbound across the whole filtered set, even though only 1 row is on this page.
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows the empty state when there are no communications', async () => {
    adminCommunicationsClient.listCommunications.mockResolvedValue(listResult([]));

    await renderAs(ADMIN);

    expect(await screen.findByText('No communications yet')).toBeInTheDocument();
  });

  it('shows the FORBIDDEN state for a staff member without view_communications', async () => {
    adminCommunicationsClient.listCommunications.mockRejectedValue({ code: 'FORBIDDEN' });

    await renderAs(FINANCE);

    expect(await screen.findByText('Access restricted')).toBeInTheDocument();
  });
});

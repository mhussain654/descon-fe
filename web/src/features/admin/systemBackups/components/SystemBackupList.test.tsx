import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from '../../../../../../shared/auth/staffAuthClient';
import { LanguageProvider } from '../../../../contexts/LanguageContext';
import { StaffAuthProvider } from '../../../../contexts/StaffAuthContext';
import { adminSystemBackupsClient } from '../../../../lib/admin-system-backups-client';
import { SystemBackupList } from './SystemBackupList';

vi.mock('../../../../lib/admin-system-backups-client', () => ({
  adminSystemBackupsClient: { listBackups: vi.fn(), requestAccess: vi.fn() },
}));

const ADMIN = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'admin')!;
const HR = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'hr')!;

async function signedInClient(account: typeof ADMIN) {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: account.email, password: MOCK_STAFF_PASSWORD });
  return client;
}

function backup(overrides: Record<string, unknown> = {}) {
  return {
    id: 'backup-1',
    status: 'succeeded' as const,
    takenAt: '2026-09-06T00:00:00Z',
    byteSize: 10_485_760,
    checksumSha256: 'abc123',
    durationSeconds: 42,
    errorMessage: null,
    ...overrides,
  };
}

function listResult(
  items: ReturnType<typeof backup>[],
  summary = [
    { code: 'in_progress' as const, count: 0 },
    { code: 'succeeded' as const, count: items.filter((item) => item.status === 'succeeded').length },
    { code: 'failed' as const, count: items.filter((item) => item.status === 'failed').length },
  ]
) {
  return { items, pagination: { page: 1, perPage: 20, totalCount: items.length, totalPages: 1 }, summary };
}

async function renderAs(account: typeof ADMIN) {
  const client = await signedInClient(account);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <StaffAuthProvider client={client}>
            <SystemBackupList />
          </StaffAuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('SystemBackupList', () => {
  afterEach(() => {
    vi.mocked(adminSystemBackupsClient.listBackups).mockReset();
  });

  it('shows the real, zero-filled status summary from the backend, not a page-scoped approximation', async () => {
    adminSystemBackupsClient.listBackups.mockResolvedValue(
      listResult([backup({ id: 'b1', status: 'succeeded' })], [
        { code: 'in_progress', count: 0 },
        { code: 'succeeded', count: 9 },
        { code: 'failed', count: 1 },
      ])
    );

    await renderAs(ADMIN);

    expect(await screen.findByText('Backup status summary')).toBeInTheDocument();
    // 9 succeeded across the whole table, even though only 1 row is on this page.
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
  });

  it('shows the empty state when there are no backups yet', async () => {
    adminSystemBackupsClient.listBackups.mockResolvedValue(listResult([], []));

    await renderAs(ADMIN);

    expect(await screen.findByText('No backups yet')).toBeInTheDocument();
  });

  it('omits the summary card when summary is empty', async () => {
    adminSystemBackupsClient.listBackups.mockResolvedValue(listResult([]));
    adminSystemBackupsClient.listBackups.mockResolvedValueOnce({ ...listResult([backup()]), summary: [] });

    await renderAs(ADMIN);

    await waitFor(() => expect(screen.queryByText('Backup status summary')).not.toBeInTheDocument());
  });

  it('shows the FORBIDDEN state for a non-admin role', async () => {
    adminSystemBackupsClient.listBackups.mockRejectedValue({ code: 'FORBIDDEN' });

    await renderAs(HR);

    expect(await screen.findByText('Access restricted')).toBeInTheDocument();
  });
});

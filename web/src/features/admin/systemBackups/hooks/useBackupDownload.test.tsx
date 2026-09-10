import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminSystemBackupsClient } from '../../../../lib/admin-system-backups-client';
import { useBackupDownload } from './useBackupDownload';

vi.mock('../../../../lib/admin-system-backups-client', () => ({
  adminSystemBackupsClient: { requestAccess: vi.fn() },
}));

function access(overrides: Record<string, unknown> = {}) {
  return {
    backupId: 'backup-1',
    url: '/rails/active_storage/blobs/redirect/xyz/backup.sql.gz',
    expiresAt: '2026-09-07T12:00:00Z',
    ...overrides,
  };
}

function renderDownloadHook() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderHook(() => useBackupDownload(), {
    wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
  });
}

describe('useBackupDownload', () => {
  afterEach(() => {
    vi.mocked(adminSystemBackupsClient.requestAccess).mockReset();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('opens a blank tab synchronously, before the access request resolves', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3000/api/v1');
    adminSystemBackupsClient.requestAccess.mockReturnValue(new Promise(() => {}));
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({ opener: null, location: { href: '' }, close: vi.fn() } as any);
    const { result } = renderDownloadHook();

    act(() => result.current.downloadBackup('backup-1'));

    expect(openSpy).toHaveBeenCalledWith('', '_blank');
  });

  it('navigates the already-open tab to the resolved same-origin URL once access is granted', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3000/api/v1');
    adminSystemBackupsClient.requestAccess.mockResolvedValue(access());
    const tab = { opener: 'something', location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(tab as any);
    const { result } = renderDownloadHook();

    act(() => result.current.downloadBackup('backup-1'));
    await waitFor(() => expect(tab.location.href).not.toBe(''));

    expect(tab.location.href).toBe('http://localhost:3000/rails/active_storage/blobs/redirect/xyz/backup.sql.gz');
    expect(tab.opener).toBeNull();
    expect(tab.close).not.toHaveBeenCalled();
  });

  it('closes the tab instead of navigating it when the access request fails', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3000/api/v1');
    adminSystemBackupsClient.requestAccess.mockRejectedValue({ code: 'SERVER_ERROR' });
    const tab = { opener: null, location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(tab as any);
    const { result } = renderDownloadHook();

    act(() => result.current.downloadBackup('backup-1'));
    await waitFor(() => expect(tab.close).toHaveBeenCalledTimes(1));

    expect(tab.location.href).toBe('');
  });

  it('closes the tab instead of navigating it when the resolved URL does not match the API origin (fails closed)', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3000/api/v1');
    adminSystemBackupsClient.requestAccess.mockResolvedValue(access({ url: 'https://evil.example/backup.sql.gz' }));
    const tab = { opener: null, location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(tab as any);
    const { result } = renderDownloadHook();

    act(() => result.current.downloadBackup('backup-1'));
    await waitFor(() => expect(tab.close).toHaveBeenCalledTimes(1));

    expect(tab.location.href).toBe('');
  });

  it('does not throw when the browser actually blocked the popup (window.open returned null)', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3000/api/v1');
    adminSystemBackupsClient.requestAccess.mockResolvedValue(access());
    vi.spyOn(window, 'open').mockReturnValue(null);
    const { result } = renderDownloadHook();

    act(() => result.current.downloadBackup('backup-1'));

    await waitFor(() => expect(adminSystemBackupsClient.requestAccess).toHaveBeenCalledTimes(1));
  });
});

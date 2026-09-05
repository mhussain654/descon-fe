import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminReportsClient } from '../../../../lib/admin-reports-client';
import { triggerBlobDownload } from '../triggerBlobDownload';
import { useReportExport } from './useReportExport';

vi.mock('../../../../lib/admin-reports-client', () => ({
  adminReportsClient: { exportReport: vi.fn() },
}));

vi.mock('../triggerBlobDownload', () => ({
  triggerBlobDownload: vi.fn(),
}));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useReportExport', () => {
  afterEach(() => {
    vi.mocked(adminReportsClient.exportReport).mockReset();
    vi.mocked(triggerBlobDownload).mockReset();
  });

  it('exports the report and triggers a file save with the returned blob and filename', async () => {
    const blob = new Blob(['csv-bytes']);
    adminReportsClient.exportReport.mockResolvedValue({ blob, filename: 'status_summary.csv' });
    const { result } = renderHook(() => useReportExport(), { wrapper });

    act(() => {
      result.current.mutate({ reportType: 'status_summary', format: 'csv' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(adminReportsClient.exportReport).toHaveBeenCalledWith('status_summary', 'csv', undefined);
    expect(triggerBlobDownload).toHaveBeenCalledWith(blob, 'status_summary.csv');
  });

  it('passes granularity params through for the trend report', async () => {
    adminReportsClient.exportReport.mockResolvedValue({ blob: new Blob(['x']), filename: 'trend.pdf' });
    const { result } = renderHook(() => useReportExport(), { wrapper });

    act(() => {
      result.current.mutate({ reportType: 'trend', format: 'pdf', params: { granularity: 'weekly' } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(adminReportsClient.exportReport).toHaveBeenCalledWith('trend', 'pdf', { granularity: 'weekly' });
  });

  it('surfaces a failed export as an error without triggering a download', async () => {
    adminReportsClient.exportReport.mockRejectedValue({ code: 'FORBIDDEN' });
    const { result } = renderHook(() => useReportExport(), { wrapper });

    act(() => {
      result.current.mutate({ reportType: 'status_summary', format: 'csv' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual({ code: 'FORBIDDEN' });
    expect(triggerBlobDownload).not.toHaveBeenCalled();
  });
});

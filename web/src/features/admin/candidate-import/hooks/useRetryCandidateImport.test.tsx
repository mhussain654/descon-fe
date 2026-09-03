import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../../../contexts/LanguageContext';
import { candidateImportClient } from '../../../../lib/candidate-import-client';
import { candidateImportQueries } from '../../../../../../shared/queryKeys/candidateImportQueries';
import { useRetryCandidateImport } from './useRetryCandidateImport';

vi.mock('../../../../lib/candidate-import-client', () => ({
  candidateImportClient: {
    downloadTemplate: vi.fn(),
    preflightImport: vi.fn(),
    commitImport: vi.fn(),
    getImportBatch: vi.fn(),
    listImportHistory: vi.fn(),
    retryImport: vi.fn(),
    downloadErrorExport: vi.fn(),
  },
}));

function batchSummary(overrides: Record<string, unknown> = {}) {
  return {
    id: 'import-1',
    status: 'queued' as const,
    sourceFilename: 'candidates.csv',
    templateVersion: 'v1',
    totalRows: 2,
    acceptedRows: 2,
    rejectedRows: 0,
    skippedRows: 0,
    committedRows: 0,
    importedRows: 0,
    errorCode: null,
    expiresAt: null,
    processedAt: null,
    failedAt: null,
    enqueuedAt: '2026-08-26T09:30:05Z',
    createdAt: '2026-08-26T09:30:00Z',
    ...overrides,
  };
}

function renderRetryHook(importId = 'import-1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { result } = renderHook(() => useRetryCandidateImport(importId), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>{children}</LanguageProvider>
      </QueryClientProvider>
    ),
  });
  return { result, queryClient };
}

describe('useRetryCandidateImport', () => {
  afterEach(() => {
    vi.mocked(candidateImportClient.retryImport).mockReset();
  });

  it('sends a fresh idempotency key on the first retry, and reuses it across a retry of the same request', async () => {
    candidateImportClient.retryImport
      .mockRejectedValueOnce({ code: 'SERVER_ERROR' })
      .mockResolvedValueOnce(batchSummary());
    const { result } = renderRetryHook();

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.mutation.isError).toBe(true));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.mutation.isSuccess).toBe(true));

    expect(candidateImportClient.retryImport).toHaveBeenCalledTimes(2);
    const [firstImportId, firstKey] = candidateImportClient.retryImport.mock.calls[0];
    const [secondImportId, secondKey] = candidateImportClient.retryImport.mock.calls[1];
    expect(firstImportId).toBe('import-1');
    expect(secondImportId).toBe('import-1');
    expect(firstKey).toEqual(expect.any(String));
    expect(firstKey).toBe(secondKey);
  });

  it('ignores repeated retry() calls while one is already in flight', async () => {
    candidateImportClient.retryImport.mockReturnValue(new Promise(() => {}));
    const { result } = renderRetryHook();

    act(() => {
      result.current.retry();
      result.current.retry();
      result.current.retry();
    });

    await waitFor(() => expect(result.current.mutation.isPending).toBe(true));
    expect(candidateImportClient.retryImport).toHaveBeenCalledTimes(1);
  });

  it('allows a fresh retry() call once the previous one has settled', async () => {
    candidateImportClient.retryImport.mockResolvedValue(batchSummary());
    const { result } = renderRetryHook();

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.mutation.isSuccess).toBe(true));

    act(() => result.current.retry());
    await waitFor(() => expect(candidateImportClient.retryImport).toHaveBeenCalledTimes(2));
  });

  it('seeds and invalidates the batch detail query on a successful retry, so the next poll picks up the new status', async () => {
    candidateImportClient.retryImport.mockResolvedValue(batchSummary({ status: 'queued' }));
    const { result, queryClient } = renderRetryHook();
    const detailKey = candidateImportQueries.detail('import-1', 'en');
    queryClient.setQueryData(detailKey, { ...batchSummary({ status: 'failed' }), rowResults: [] });

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.mutation.isSuccess).toBe(true));

    const cached = queryClient.getQueryData(detailKey) as { status: string } | undefined;
    expect(cached?.status).toBe('queued');
    expect(queryClient.getQueryState(detailKey)?.isInvalidated).toBe(true);
  });
});

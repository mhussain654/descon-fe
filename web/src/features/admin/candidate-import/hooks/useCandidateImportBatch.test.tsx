import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../../../contexts/LanguageContext';
import { candidateImportClient } from '../../../../lib/candidate-import-client';
import { useCandidateImportBatch } from './useCandidateImportBatch';

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

function batchPayload(overrides: Record<string, unknown> = {}) {
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
    rowResults: [],
    ...overrides,
  };
}

function renderBatchHook(importId: string | undefined) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderHook(() => useCandidateImportBatch(importId), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>{children}</LanguageProvider>
      </QueryClientProvider>
    ),
  });
}

describe('useCandidateImportBatch', () => {
  afterEach(() => {
    vi.mocked(candidateImportClient.getImportBatch).mockReset();
  });

  it('does not fetch when importId is undefined', async () => {
    const { result } = renderBatchHook(undefined);

    expect(result.current.fetchStatus).toBe('idle');
    expect(candidateImportClient.getImportBatch).not.toHaveBeenCalled();
  });

  it('fetches the batch by id once enabled', async () => {
    candidateImportClient.getImportBatch.mockResolvedValue(batchPayload({ status: 'completed', processedAt: '2026-08-26T09:35:00Z' }));
    const { result } = renderBatchHook('import-1');

    await waitFor(() => expect(result.current.data?.status).toBe('completed'));
    expect(candidateImportClient.getImportBatch).toHaveBeenCalledWith('import-1');
  });

  it('polls on the controlled backoff schedule while queued/processing, and stops on a terminal status', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    candidateImportClient.getImportBatch
      .mockResolvedValueOnce(batchPayload({ status: 'queued' }))
      .mockResolvedValueOnce(batchPayload({ status: 'processing' }))
      .mockResolvedValueOnce(batchPayload({ status: 'completed', processedAt: '2026-08-26T09:35:00Z' }));
    const { result } = renderBatchHook('import-1');

    await vi.waitFor(() => expect(result.current.data?.status).toBe('queued'));
    // dataUpdateCount is 1 after the initial fetch, so the next poll's delay
    // is POLL_INTERVALS_MS[1] = 3000ms (see pollingBackoff.ts), not the
    // schedule's first entry.
    await vi.advanceTimersByTimeAsync(3_000);
    await vi.waitFor(() => expect(result.current.data?.status).toBe('processing'));
    await vi.advanceTimersByTimeAsync(5_000);
    await vi.waitFor(() => expect(result.current.data?.status).toBe('completed'));

    const callsAtCompletion = candidateImportClient.getImportBatch.mock.calls.length;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(candidateImportClient.getImportBatch).toHaveBeenCalledTimes(callsAtCompletion);

    vi.useRealTimers();
  });

  it('surfaces a rejected error without retrying (retry: false)', async () => {
    candidateImportClient.getImportBatch.mockRejectedValue({ code: 'NOT_FOUND' });
    const { result } = renderBatchHook('missing-import');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual({ code: 'NOT_FOUND' });
    expect(candidateImportClient.getImportBatch).toHaveBeenCalledTimes(1);
  });
});

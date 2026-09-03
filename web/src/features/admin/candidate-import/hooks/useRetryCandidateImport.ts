import { useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import {
  candidateImportClient,
  type CandidateImportBatchSummary,
  type CandidateImportError,
} from '../../../../lib/candidate-import-client';
import { candidateImportQueries } from '../../../../../../shared/queryKeys/candidateImportQueries';

function randomIdempotencyKey(): string {
  return `candidate-import-retry-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Retries a `failed` batch (ticket: "Connect failed-import retry using a
 * stable Idempotency-Key"). A fresh key is minted lazily, in a ref rather
 * than state, the moment the first intentional retry click actually runs
 * its mutationFn -- a ref is immediately readable within that same call,
 * unlike state (which only updates on the next render), so this same key
 * is guaranteed to be reused correctly on a retry *of that same request*
 * (a network/server failure retrying the retry itself), matching the same
 * pattern as commit's own idempotency handling. Once the retry is
 * accepted, seeds the batch detail query with the new `queued` status (and
 * invalidates it) so useCandidateImportBatch's next render/poll picks it
 * up rather than showing a stale `failed` one.
 */
export function useRetryCandidateImport(importId: string) {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const idempotencyKeyRef = useRef<string | null>(null);
  const isRetryingRef = useRef(false);

  const mutation = useMutation<CandidateImportBatchSummary, CandidateImportError, void>({
    mutationFn: () => {
      if (!idempotencyKeyRef.current) idempotencyKeyRef.current = randomIdempotencyKey();
      return candidateImportClient.retryImport(importId, idempotencyKeyRef.current);
    },
    onSuccess: (batch) => {
      queryClient.setQueryData(candidateImportQueries.detail(batch.id, language), (previous: unknown) =>
        previous && typeof previous === 'object' ? { ...previous, ...batch } : previous
      );
      queryClient.invalidateQueries({ queryKey: candidateImportQueries.detail(batch.id, language) });
    },
    onSettled: () => {
      isRetryingRef.current = false;
    },
  });

  const retry = useCallback(() => {
    if (isRetryingRef.current) return;
    isRetryingRef.current = true;
    mutation.mutate();
  }, [mutation]);

  return { retry, mutation };
}

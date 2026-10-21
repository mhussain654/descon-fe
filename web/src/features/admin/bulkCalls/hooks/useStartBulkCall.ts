import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminBulkCallsClient } from '../../../../lib/admin-bulk-calls-client';
import type { AdminBulkCallError, BulkCallBatch } from '../../../../lib/admin-bulk-calls-client';
import {
  EMPTY_BULK_CALL_IDEMPOTENCY_KEY_STATE,
  clearBulkCallIdempotencyKey,
  randomBulkCallIdempotencyKey,
  resolveBulkCallIdempotencyKey,
  type BulkCallSelection,
} from '../../../../../../shared/adminBulkCalls/idempotency';
import { adminBulkCallQueries } from '../../../../../../shared/queryKeys/adminBulkCallQueries';

/**
 * Starts a bulk call. The Idempotency-Key is kept while the selection is
 * unchanged, so a double click or a retry after a dropped response replays the
 * batch already started rather than starting another; after a success it is
 * cleared, so the next batch (even with the same selection) is a new action.
 */
export function useStartBulkCall() {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const keyState = useRef(EMPTY_BULK_CALL_IDEMPOTENCY_KEY_STATE);

  return useMutation<BulkCallBatch, AdminBulkCallError, BulkCallSelection>({
    mutationFn: (selection) => {
      keyState.current = resolveBulkCallIdempotencyKey(keyState.current, selection, randomBulkCallIdempotencyKey);
      return adminBulkCallsClient.startBatch({ ...selection, idempotencyKey: keyState.current.key as string });
    },
    onSuccess: () => {
      keyState.current = clearBulkCallIdempotencyKey();
      // Who is "still to call" and the recent batches both changed.
      queryClient.invalidateQueries({ queryKey: adminBulkCallQueries.candidatesAll });
      queryClient.invalidateQueries({ queryKey: adminBulkCallQueries.batches(language) });
    },
  });
}

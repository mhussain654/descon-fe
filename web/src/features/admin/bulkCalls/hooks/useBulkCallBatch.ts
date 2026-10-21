import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminBulkCallsClient } from '../../../../lib/admin-bulk-calls-client';
import type { AdminBulkCallError, BulkCallBatch } from '../../../../lib/admin-bulk-calls-client';
import { adminBulkCallQueries } from '../../../../../../shared/queryKeys/adminBulkCallQueries';

const POLL_MS = 5000;

/** One batch with each candidate's result; refreshed every few seconds while calls are still waiting (and while their outcomes are still arriving). */
export function useBulkCallBatch(id: string) {
  const { language } = useLanguage();

  return useQuery<BulkCallBatch, AdminBulkCallError>({
    queryKey: adminBulkCallQueries.batch(language, id),
    queryFn: () => adminBulkCallsClient.getBatch(id),
    refetchInterval: (query) => {
      const batch = query.state.data;
      if (!batch) return false;
      const outcomePending = batch.items?.some((item) => item.status === 'placed' && !item.call?.outcome && item.call?.status !== 'failed') ?? false;
      return batch.counts.queued > 0 || outcomePending ? POLL_MS : false;
    },
  });
}

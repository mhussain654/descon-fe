import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminBulkCallsClient } from '../../../../lib/admin-bulk-calls-client';
import type { AdminBulkCallError, BulkCallBatch } from '../../../../lib/admin-bulk-calls-client';
import { adminBulkCallQueries } from '../../../../../../shared/queryKeys/adminBulkCallQueries';

const POLL_MS = 5000;

/** The recent batches; refreshed every few seconds while any of them still has calls waiting, so the progress moves on its own. */
export function useBulkCallBatches() {
  const { language } = useLanguage();

  return useQuery<BulkCallBatch[], AdminBulkCallError>({
    queryKey: adminBulkCallQueries.batches(language),
    queryFn: () => adminBulkCallsClient.listBatches(),
    refetchInterval: (query) => (query.state.data?.some((batch) => batch.counts.queued > 0) ? POLL_MS : false),
  });
}

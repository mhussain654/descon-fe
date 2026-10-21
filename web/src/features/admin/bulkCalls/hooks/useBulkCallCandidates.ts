import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminBulkCallsClient } from '../../../../lib/admin-bulk-calls-client';
import type { AdminBulkCallError, BulkCallCandidatesQuery, BulkCallCandidatesResult } from '../../../../lib/admin-bulk-calls-client';
import { adminBulkCallQueries } from '../../../../../../shared/queryKeys/adminBulkCallQueries';

/**
 * The candidates at the chosen stage, with whether each was called with the
 * chosen call type. Only runs once both a stage and a call type are chosen
 * (`query` is undefined until then). The key holds the whole query, so a
 * response for an old selection can never overwrite the current one.
 */
export function useBulkCallCandidates(query: BulkCallCandidatesQuery | undefined) {
  const { language } = useLanguage();

  return useQuery<BulkCallCandidatesResult, AdminBulkCallError>({
    queryKey: query ? adminBulkCallQueries.candidates(language, query) : adminBulkCallQueries.candidatesAll,
    queryFn: () => adminBulkCallsClient.listCandidates(query as BulkCallCandidatesQuery),
    enabled: query !== undefined,
    placeholderData: keepPreviousData,
  });
}

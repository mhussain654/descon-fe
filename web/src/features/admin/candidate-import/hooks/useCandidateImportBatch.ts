import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { candidateImportClient, type CandidateImportBatchDetail, type CandidateImportError } from '../../../../lib/candidate-import-client';
import { candidateImportQueries } from '../../../../../../shared/queryKeys/candidateImportQueries';
import { isTerminalImportStatus, nextImportPollDelayMs } from '../../../../../../shared/adminCandidateImport/pollingBackoff';

/**
 * The sole source of truth for a batch's status, final counts and row
 * results (ticket: "Render final counts and row results from the detail
 * API only"). Polls with a controlled backoff schedule
 * (shared/adminCandidateImport/pollingBackoff.ts) while the batch is
 * `queued`/`processing`, and stops the moment it reaches any terminal
 * status (`completed`/`partial`/`failed`/`invalidated`) -- `refetchInterval`
 * returning `false` is what actually stops polling; there is no separate
 * timer to clean up, and TanStack Query itself cancels the interval on
 * unmount (ticket: "polling cleanup").
 *
 * `query.state.dataUpdateCount` (how many times this query has actually
 * resolved so far) drives the backoff schedule directly -- no separate
 * poll-count ref needed, and it naturally starts over correctly on a fresh
 * mount (e.g. navigating away and back, ticket: "Support page refresh").
 */
export function useCandidateImportBatch(importId: string | undefined) {
  const { language } = useLanguage();

  return useQuery<CandidateImportBatchDetail, CandidateImportError>({
    queryKey: candidateImportQueries.detail(importId ?? '', language),
    queryFn: () => candidateImportClient.getImportBatch(importId as string),
    enabled: Boolean(importId),
    retry: false,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
    refetchInterval: (activeQuery) => {
      const data = activeQuery.state.data;
      if (!data || isTerminalImportStatus(data.status)) return false;
      return nextImportPollDelayMs(activeQuery.state.dataUpdateCount);
    },
  });
}

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../contexts/AuthContext';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { applicationProgressClient } from '../../../../lib/application-progress-client';
import type { ApplicationProgress, ApplicationProgressError } from '../../../../lib/application-progress-client';
import { documentQueries } from '../../../../../../shared/queryKeys/documentQueries';
import { PENDING_REVIEW_POLL_INTERVAL_MS } from '../../../../../../shared/candidateDocuments/pendingReviewPolling';

/**
 * Fetches the authenticated candidate's own application progress. Mirrors
 * web/src/features/candidate/progress/hooks/useApplicationProgress.ts
 * exactly -- see that file for the query-key, focus-refetch, and polling
 * rationale.
 *
 * The explicit `<ApplicationProgress, ApplicationProgressError>` generics
 * matter: `useQuery` otherwise defaults its error type to the built-in
 * `Error` (no `code`), which only surfaces as a real type error once
 * `query.error` is consumed directly inside a strictly-typed `.tsx`
 * component rather than routed through an untyped `.jsx` page boundary.
 */
export function useApplicationProgress() {
  const { session, status } = useAuth();
  const { language } = useLanguage();
  const candidateId = session?.candidateId ?? 'anonymous';

  return useQuery<ApplicationProgress, ApplicationProgressError>({
    queryKey: documentQueries.applicationProgress(candidateId, language),
    queryFn: () => applicationProgressClient.getProgress((session as { accessToken: string }).accessToken),
    enabled: status === 'authenticated' && !!session,
    retry: false,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
    refetchInterval: (query) => ((query.state.data?.documents.pendingReview ?? 0) > 0 ? PENDING_REVIEW_POLL_INTERVAL_MS : false),
  });
}

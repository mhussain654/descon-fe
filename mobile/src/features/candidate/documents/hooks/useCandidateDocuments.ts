import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../contexts/AuthContext';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { candidateDocumentsClient } from '../../../../lib/candidate-documents-client';
import { documentQueries } from '../../../../../../shared/queryKeys/documentQueries';
import { hasPendingRequiredDocument, PENDING_REVIEW_POLL_INTERVAL_MS } from '../../../../../../shared/candidateDocuments/pendingReviewPolling';

/**
 * Fetches the authenticated candidate's own document checklist. Mirrors
 * web/src/features/candidate/documents/hooks/useCandidateDocuments.ts
 * exactly -- see that file for the query-key and polling rationale.
 * `refetchOnWindowFocus`/`refetchIntervalInBackground` only mean something
 * on native once `focusManager` is wired to `AppState` (see
 * mobile/src/app/_layout.jsx); screen-focus (tab switch) refetching is a
 * separate concern handled by the screen via `useFocusEffect`.
 */
export function useCandidateDocuments() {
  const { session, status } = useAuth();
  const { language } = useLanguage();
  const candidateId = session?.candidateId ?? 'anonymous';

  return useQuery({
    queryKey: documentQueries.candidateChecklist(candidateId, language),
    queryFn: () => candidateDocumentsClient.getChecklist((session as { accessToken: string }).accessToken),
    enabled: status === 'authenticated' && !!session,
    retry: false,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
    refetchInterval: (query) => (hasPendingRequiredDocument(query.state.data) ? PENDING_REVIEW_POLL_INTERVAL_MS : false),
  });
}

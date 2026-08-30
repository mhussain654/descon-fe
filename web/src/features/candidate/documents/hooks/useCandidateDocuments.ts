import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../contexts/AuthContext';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { candidateDocumentsClient } from '../../../../lib/candidate-documents-client';
import { documentQueries } from '../../../../../../shared/queryKeys/documentQueries';
import { hasPendingRequiredDocument, PENDING_REVIEW_POLL_INTERVAL_MS } from '../../../../../../shared/candidateDocuments/pendingReviewPolling';

/**
 * Fetches the authenticated candidate's own document checklist. Identity
 * comes only from `session.accessToken` -- there is no candidate id
 * parameter this hook could be made to substitute (ticket: "Do not leak one
 * candidate's checklist into another candidate's session."). The query key
 * itself is keyed by `session.candidateId` (never the token) and locale --
 * see shared/queryKeys/documentQueries.ts.
 *
 * No automatic retry -- mirrors useCandidateProfile.ts's identical
 * rationale: every error state maps to a distinct, visible UI state with
 * its own explicit "Retry" action.
 *
 * Live sync (ticket: "Refetch documents when the Documents screen gains
 * focus" / "conservative visible-screen polling while pending_review"):
 * `refetchOnWindowFocus` re-fetches on tab/window focus, and `refetchInterval`
 * polls only while a required document is actually pending_review, stopping
 * automatically once every required document resolves or the tab is hidden
 * (`refetchIntervalInBackground: false`).
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

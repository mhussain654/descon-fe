import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../contexts/AuthContext';
import { candidateDocumentsClient } from '../../../../lib/candidate-documents-client';

/** Stable across the whole app so AuthContext's `queryClient.clear()` on logout reliably drops it (AGENTS.md/ticket: "Clear candidate document query/cache data during logout."). */
export const CANDIDATE_DOCUMENTS_QUERY_KEY = ['candidate-documents'] as const;

/**
 * Fetches the authenticated candidate's own document checklist. Identity
 * comes only from `session.accessToken` -- there is no candidate id
 * parameter this hook could be made to substitute (ticket: "Do not leak one
 * candidate's checklist into another candidate's session.").
 *
 * No automatic retry -- mirrors useCandidateProfile.ts's identical
 * rationale: every error state maps to a distinct, visible UI state with
 * its own explicit "Retry" action.
 */
export function useCandidateDocuments() {
  const { session, status } = useAuth();

  return useQuery({
    queryKey: CANDIDATE_DOCUMENTS_QUERY_KEY,
    queryFn: () => candidateDocumentsClient.getChecklist((session as { accessToken: string }).accessToken),
    enabled: status === 'authenticated' && !!session,
    retry: false,
  });
}

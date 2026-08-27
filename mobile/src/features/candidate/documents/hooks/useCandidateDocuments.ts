import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../contexts/AuthContext';
import { candidateDocumentsClient } from '../../../../lib/candidate-documents-client';

/** Stable across the whole app so AuthContext's `queryClient.clear()` on logout reliably drops it (ticket: "Clear candidate document query/cache data during logout."). Matches web's key exactly. */
export const CANDIDATE_DOCUMENTS_QUERY_KEY = ['candidate-documents'] as const;

/** Fetches the authenticated candidate's own document checklist. Mirrors web/src/features/candidate/documents/hooks/useCandidateDocuments.ts exactly. */
export function useCandidateDocuments() {
  const { session, status } = useAuth();

  return useQuery({
    queryKey: CANDIDATE_DOCUMENTS_QUERY_KEY,
    queryFn: () => candidateDocumentsClient.getChecklist((session as { accessToken: string }).accessToken),
    enabled: status === 'authenticated' && !!session,
    retry: false,
  });
}

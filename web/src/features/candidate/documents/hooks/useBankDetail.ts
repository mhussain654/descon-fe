import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../contexts/AuthContext';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { candidateBankDetailsClient } from '../../../../lib/candidate-bank-details-client';
import { documentQueries } from '../../../../../../shared/queryKeys/documentQueries';

/**
 * Fetches the authenticated candidate's own bank-detail submission state.
 * Identity comes only from `session.accessToken`, mirroring
 * useCandidateDocuments.ts's identical rationale. No automatic retry --
 * every error state maps to a distinct, visible UI state with its own
 * explicit "Retry" action.
 */
export function useBankDetail() {
  const { session, status } = useAuth();
  const { language } = useLanguage();
  const candidateId = session?.candidateId ?? 'anonymous';

  return useQuery({
    queryKey: documentQueries.bankDetail(candidateId, language),
    queryFn: () => candidateBankDetailsClient.getBankDetail((session as { accessToken: string }).accessToken),
    enabled: status === 'authenticated' && !!session,
    retry: false,
  });
}

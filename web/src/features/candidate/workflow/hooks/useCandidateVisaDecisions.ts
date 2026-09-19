import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../contexts/AuthContext';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { candidateVisaDecisionsClient } from '../../../../lib/candidate-visa-decisions-client';
import { workflowQueries } from '../../../../../../shared/queryKeys/workflowQueries';

/**
 * Fetches the authenticated candidate's own recorded visa decisions --
 * mirrors useCandidateFlightDetail.ts's identical retry/error-handling
 * rationale. `visaCopyAttached` on the latest decision is the only signal
 * that gates the Status page's "Download visa copy" action; it is never
 * inferred from the visa_issued_or_rejected workflow stage alone.
 */
export function useCandidateVisaDecisions() {
  const { session, status } = useAuth();
  const { language } = useLanguage();
  const candidateId = session?.candidateId ?? 'anonymous';

  return useQuery({
    queryKey: workflowQueries.visaDecisions(candidateId, language),
    queryFn: () => candidateVisaDecisionsClient.listVisaDecisions((session as { accessToken: string }).accessToken),
    enabled: status === 'authenticated' && !!session,
    retry: false,
  });
}

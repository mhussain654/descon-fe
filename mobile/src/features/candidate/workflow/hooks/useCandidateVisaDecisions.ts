import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../contexts/AuthContext';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { candidateVisaDecisionsClient } from '../../../../lib/candidate-visa-decisions-client';
import type { CandidateVisaDecision, CandidateVisaDecisionsError } from '../../../../lib/candidate-visa-decisions-client';
import { workflowQueries } from '../../../../../../shared/queryKeys/workflowQueries';

/**
 * Fetches the authenticated candidate's own recorded visa decisions --
 * mirrors web/src/features/candidate/workflow/hooks/useCandidateVisaDecisions.ts
 * exactly. Explicit generics type the error as CandidateVisaDecisionsError
 * rather than TanStack Query's default `Error`, since the status screen
 * reads `.code` off it (see useCandidateFlightDetail.ts's identical rationale).
 */
export function useCandidateVisaDecisions() {
  const { session, status } = useAuth();
  const { language } = useLanguage();
  const candidateId = session?.candidateId ?? 'anonymous';

  return useQuery<CandidateVisaDecision[], CandidateVisaDecisionsError>({
    queryKey: workflowQueries.visaDecisions(candidateId, language),
    queryFn: () => candidateVisaDecisionsClient.listVisaDecisions((session as { accessToken: string }).accessToken),
    enabled: status === 'authenticated' && !!session,
    retry: false,
  });
}

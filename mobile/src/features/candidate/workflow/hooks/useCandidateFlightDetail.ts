import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../contexts/AuthContext';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { candidateFlightDetailClient } from '../../../../lib/candidate-flight-detail-client';
import type { CandidateFlightDetail, CandidateFlightDetailError } from '../../../../lib/candidate-flight-detail-client';
import { workflowQueries } from '../../../../../../shared/queryKeys/workflowQueries';

/**
 * Fetches the authenticated candidate's own recorded flight detail --
 * mirrors web/src/features/candidate/workflow/hooks/useCandidateFlightDetail.ts
 * exactly. Explicit generics type the error as CandidateFlightDetailError
 * rather than TanStack Query's default `Error`, since the status screen
 * reads `.code` off it.
 */
export function useCandidateFlightDetail() {
  const { session, status } = useAuth();
  const { language } = useLanguage();
  const candidateId = session?.candidateId ?? 'anonymous';

  return useQuery<CandidateFlightDetail | null, CandidateFlightDetailError>({
    queryKey: workflowQueries.flightDetail(candidateId, language),
    queryFn: () => candidateFlightDetailClient.getFlightDetail((session as { accessToken: string }).accessToken),
    enabled: status === 'authenticated' && !!session,
    retry: false,
  });
}

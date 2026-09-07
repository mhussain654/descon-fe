import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../contexts/AuthContext';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { candidateFlightDetailClient } from '../../../../lib/candidate-flight-detail-client';
import { workflowQueries } from '../../../../../../shared/queryKeys/workflowQueries';

/**
 * Fetches the authenticated candidate's own recorded flight detail --
 * resolves to `null` before one has been recorded, mirroring
 * useCandidateWorkflowHistory.ts's identical retry/error-handling
 * rationale. `ticketAttached` is the only signal that gates the Status
 * page's "Download Ticket" action; it is never inferred from the
 * flight_details_uploaded/mobilized workflow stage alone.
 */
export function useCandidateFlightDetail() {
  const { session, status } = useAuth();
  const { language } = useLanguage();
  const candidateId = session?.candidateId ?? 'anonymous';

  return useQuery({
    queryKey: workflowQueries.flightDetail(candidateId, language),
    queryFn: () => candidateFlightDetailClient.getFlightDetail((session as { accessToken: string }).accessToken),
    enabled: status === 'authenticated' && !!session,
    retry: false,
  });
}

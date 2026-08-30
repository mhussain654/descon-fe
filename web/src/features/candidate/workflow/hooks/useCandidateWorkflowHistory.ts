import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../contexts/AuthContext';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { candidateWorkflowClient } from '../../../../lib/candidate-workflow-client';
import { workflowQueries } from '../../../../../../shared/queryKeys/workflowQueries';

/**
 * Fetches the authenticated candidate's own workflow transition history
 * (ticket MPS-501) -- the only source for QVC/visa outcome evidence and any
 * "workflow history" list, since that evidence lives only on the specific
 * transition that recorded it, never on the Status screen's own timeline
 * snapshot (see useApplicationProgress.ts's `workflow.timeline`). Mirrors
 * useCandidateProfile.ts's rationale for retry/error-handling exactly.
 */
export function useCandidateWorkflowHistory() {
  const { session, status } = useAuth();
  const { language } = useLanguage();
  const candidateId = session?.candidateId ?? 'anonymous';

  return useQuery({
    queryKey: workflowQueries.history(candidateId, language),
    queryFn: () => candidateWorkflowClient.getWorkflowHistory((session as { accessToken: string }).accessToken),
    enabled: status === 'authenticated' && !!session,
    retry: false,
    refetchOnWindowFocus: true,
  });
}

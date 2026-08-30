import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../contexts/AuthContext';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { candidateWorkflowClient } from '../../../../lib/candidate-workflow-client';
import { workflowQueries } from '../../../../../../shared/queryKeys/workflowQueries';

/**
 * Fetches the authenticated candidate's own workflow transition history
 * (ticket MPS-501). Mirrors
 * web/src/features/candidate/workflow/hooks/useCandidateWorkflowHistory.ts
 * exactly -- screen-focus/tab-switch refetching is a separate concern
 * handled by the screen via `useFocusEffect`, same as useCandidateProfile.ts.
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

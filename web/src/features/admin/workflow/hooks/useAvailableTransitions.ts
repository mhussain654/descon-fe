import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminWorkflowClient } from '../../../../lib/admin-workflow-client';
import type { AdminWorkflowError, AllowedWorkflowTransitions } from '../../../../lib/admin-workflow-client';
import { workflowQueries } from '../../../../../../shared/queryKeys/workflowQueries';

export function useAvailableTransitions(candidateId: string | undefined) {
  const { language } = useLanguage();

  return useQuery<AllowedWorkflowTransitions, AdminWorkflowError>({
    queryKey: workflowQueries.adminTransitions(candidateId ?? '', language),
    queryFn: () => adminWorkflowClient.getAllowedTransitions(candidateId as string),
    enabled: Boolean(candidateId),
  });
}

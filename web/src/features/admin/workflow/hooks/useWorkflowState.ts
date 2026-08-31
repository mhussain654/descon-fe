import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminWorkflowClient } from '../../../../lib/admin-workflow-client';
import type { AdminWorkflowError, AdminWorkflowState } from '../../../../lib/admin-workflow-client';
import { workflowQueries } from '../../../../../../shared/queryKeys/workflowQueries';

export function useWorkflowState(candidateId: string | undefined) {
  const { language } = useLanguage();

  return useQuery<AdminWorkflowState, AdminWorkflowError>({
    queryKey: workflowQueries.adminState(candidateId ?? '', language),
    queryFn: () => adminWorkflowClient.getWorkflowState(candidateId as string),
    enabled: Boolean(candidateId),
  });
}

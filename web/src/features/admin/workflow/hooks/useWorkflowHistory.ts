import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminWorkflowClient } from '../../../../lib/admin-workflow-client';
import type { AdminWorkflowError, AdminWorkflowHistory } from '../../../../lib/admin-workflow-client';
import { workflowQueries } from '../../../../../../shared/queryKeys/workflowQueries';

export function useWorkflowHistory(candidateId: string | undefined) {
  const { language } = useLanguage();

  return useQuery<AdminWorkflowHistory, AdminWorkflowError>({
    queryKey: workflowQueries.adminHistory(candidateId ?? '', language),
    queryFn: () => adminWorkflowClient.getWorkflowHistory(candidateId as string),
    enabled: Boolean(candidateId),
  });
}

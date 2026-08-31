import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminWorkflowClient } from '../../../../lib/admin-workflow-client';
import type { AdminQvcAttempts, AdminWorkflowError } from '../../../../lib/admin-workflow-client';
import { workflowQueries } from '../../../../../../shared/queryKeys/workflowQueries';

export function useQvcAttempts(candidateId: string | undefined) {
  const { language } = useLanguage();

  return useQuery<AdminQvcAttempts, AdminWorkflowError>({
    queryKey: workflowQueries.adminQvcAttempts(candidateId ?? '', language),
    queryFn: () => adminWorkflowClient.getQvcAttempts(candidateId as string),
    enabled: Boolean(candidateId),
  });
}

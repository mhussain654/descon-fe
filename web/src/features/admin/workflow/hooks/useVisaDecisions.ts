import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminWorkflowClient } from '../../../../lib/admin-workflow-client';
import type { AdminVisaDecisions, AdminWorkflowError } from '../../../../lib/admin-workflow-client';
import { workflowQueries } from '../../../../../../shared/queryKeys/workflowQueries';

export function useVisaDecisions(candidateId: string | undefined) {
  const { language } = useLanguage();

  return useQuery<AdminVisaDecisions, AdminWorkflowError>({
    queryKey: workflowQueries.adminVisaDecisions(candidateId ?? '', language),
    queryFn: () => adminWorkflowClient.getVisaDecisions(candidateId as string),
    enabled: Boolean(candidateId),
  });
}

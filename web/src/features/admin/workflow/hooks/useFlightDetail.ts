import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminWorkflowClient } from '../../../../lib/admin-workflow-client';
import type { AdminFlightDetailShow, AdminWorkflowError } from '../../../../lib/admin-workflow-client';
import { workflowQueries } from '../../../../../../shared/queryKeys/workflowQueries';

export function useFlightDetail(candidateId: string | undefined) {
  const { language } = useLanguage();

  return useQuery<AdminFlightDetailShow, AdminWorkflowError>({
    queryKey: workflowQueries.adminFlightDetail(candidateId ?? '', language),
    queryFn: () => adminWorkflowClient.getFlightDetail(candidateId as string),
    enabled: Boolean(candidateId),
  });
}

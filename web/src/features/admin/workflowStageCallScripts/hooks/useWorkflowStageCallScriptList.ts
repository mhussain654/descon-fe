import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminWorkflowStageCallScriptsClient } from '../../../../lib/admin-workflow-stage-call-scripts-client';
import { adminWorkflowStageCallScriptQueries } from '../../../../../../shared/queryKeys/adminWorkflowStageCallScriptQueries';

/** The full list of workflow-stage call scripts -- unpaginated, matching the backend's own fixed, small (at most 15) row set. */
export function useWorkflowStageCallScriptList() {
  const { language } = useLanguage();

  return useQuery({
    queryKey: adminWorkflowStageCallScriptQueries.list(language),
    queryFn: () => adminWorkflowStageCallScriptsClient.listWorkflowStageCallScripts(),
  });
}

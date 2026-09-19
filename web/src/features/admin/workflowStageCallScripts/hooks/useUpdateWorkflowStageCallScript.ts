import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { toast } from '../../../../design-system';
import { adminWorkflowStageCallScriptsClient } from '../../../../lib/admin-workflow-stage-call-scripts-client';
import type {
  WorkflowStageCallScript,
  WorkflowStageCallScriptError,
  WorkflowStageCallScriptUpdateInput,
} from '../../../../lib/admin-workflow-stage-call-scripts-client';
import type { CanonicalWorkflowStageCode } from '../../../../../../shared/adminWorkflow/canonicalStages';
import { adminWorkflowStageCallScriptQueries } from '../../../../../../shared/queryKeys/adminWorkflowStageCallScriptQueries';

interface UpdateVariables {
  workflowStageCode: CanonicalWorkflowStageCode;
  input: WorkflowStageCallScriptUpdateInput;
}

/**
 * Updates one workflow stage's call script. No Idempotency-Key and no
 * confirm dialog (unlike useTriggerCandidateAiCall.ts) -- editing content
 * has no external side effect to dedupe or consequence to guard against a
 * double click the way placing a real phone call does.
 */
export function useUpdateWorkflowStageCallScript() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();

  return useMutation<WorkflowStageCallScript, WorkflowStageCallScriptError, UpdateVariables>({
    mutationFn: (variables) => adminWorkflowStageCallScriptsClient.updateWorkflowStageCallScript(variables.workflowStageCode, variables.input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminWorkflowStageCallScriptQueries.list(language) });
      toast.success(t('adminWorkflowStageCallScriptUpdateSuccessToast'));
    },
  });
}

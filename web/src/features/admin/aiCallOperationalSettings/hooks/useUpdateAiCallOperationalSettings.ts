import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { toast } from '../../../../design-system';
import { adminAiCallOperationalSettingsClient } from '../../../../lib/admin-ai-call-operational-settings-client';
import type {
  AiCallOperationalSetting,
  AiCallOperationalSettingError,
  AiCallOperationalSettingUpdateInput,
} from '../../../../lib/admin-ai-call-operational-settings-client';
import { adminAiCallOperationalSettingQueries } from '../../../../../../shared/queryKeys/adminAiCallOperationalSettingQueries';

/** Updates the singleton operational settings row. No Idempotency-Key and no confirm dialog (mirrors useUpdateWorkflowStageCallScript.ts's identical rationale) -- this is business-tunable configuration, not a consequential external action. */
export function useUpdateAiCallOperationalSettings() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();

  return useMutation<AiCallOperationalSetting, AiCallOperationalSettingError, AiCallOperationalSettingUpdateInput>({
    mutationFn: (input) => adminAiCallOperationalSettingsClient.updateAiCallOperationalSettings(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminAiCallOperationalSettingQueries.get(language) });
      toast.success(t('adminAiCallSettingsUpdateSuccessToast'));
    },
  });
}

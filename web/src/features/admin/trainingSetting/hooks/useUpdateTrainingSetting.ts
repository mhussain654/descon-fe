import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { toast } from '../../../../design-system';
import { adminTrainingSettingClient } from '../../../../lib/admin-training-setting-client';
import type { AdminTrainingSetting, AdminTrainingSettingError, AdminTrainingSettingUpdateInput } from '../../../../lib/admin-training-setting-client';
import { adminTrainingSettingQueries } from '../../../../../../shared/queryKeys/adminTrainingSettingQueries';

/** Updates the singleton training-link row. No Idempotency-Key and no confirm dialog (mirrors useUpdateAiCallOperationalSettings.ts's identical rationale) -- this is business-tunable configuration, not a consequential external action. */
export function useUpdateTrainingSetting() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();

  return useMutation<AdminTrainingSetting, AdminTrainingSettingError, AdminTrainingSettingUpdateInput>({
    mutationFn: (input) => adminTrainingSettingClient.updateTrainingSetting(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminTrainingSettingQueries.get(language) });
      toast.success(t('adminTrainingSettingUpdateSuccessToast'));
    },
  });
}

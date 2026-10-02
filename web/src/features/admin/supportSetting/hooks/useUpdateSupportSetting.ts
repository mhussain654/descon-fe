import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { toast } from '../../../../design-system';
import { adminSupportSettingClient } from '../../../../lib/admin-support-setting-client';
import type { AdminSupportSetting, AdminSupportSettingError, AdminSupportSettingUpdateInput } from '../../../../lib/admin-support-setting-client';
import { adminSupportSettingQueries } from '../../../../../../shared/queryKeys/adminSupportSettingQueries';

/** Updates the singleton support-number row. No Idempotency-Key and no confirm dialog (mirrors useUpdateAiCallOperationalSettings.ts's identical rationale) -- this is business-tunable configuration, not a consequential external action. */
export function useUpdateSupportSetting() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();

  return useMutation<AdminSupportSetting, AdminSupportSettingError, AdminSupportSettingUpdateInput>({
    mutationFn: (input) => adminSupportSettingClient.updateSupportSetting(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminSupportSettingQueries.get(language) });
      toast.success(t('adminSupportSettingUpdateSuccessToast'));
    },
  });
}

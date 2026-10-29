import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { toast } from '../../../../design-system';
import { adminAppSettingsClient } from '../../../../lib/admin-app-settings-client';
import type { AdminAppSettings, AdminAppSettingsError, AdminAppSettingsUpdateInput } from '../../../../lib/admin-app-settings-client';
import { adminAppSettingsQueries } from '../../../../../../shared/queryKeys/adminAppSettingsQueries';

/** Saves the feature switches. No confirm dialog -- mirrors useUpdateSupportSetting.ts: configuration, reversible at any time. */
export function useUpdateAppSettings() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();

  return useMutation<AdminAppSettings, AdminAppSettingsError, AdminAppSettingsUpdateInput>({
    mutationFn: (input) => adminAppSettingsClient.updateAppSettings(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminAppSettingsQueries.get(language) });
      toast.success(t('adminAppSettingsUpdateSuccessToast'));
    },
  });
}

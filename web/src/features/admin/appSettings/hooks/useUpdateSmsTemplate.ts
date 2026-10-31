import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { toast } from '../../../../design-system';
import { adminAppSettingsClient } from '../../../../lib/admin-app-settings-client';
import type { AdminAppSettingsError, SmsTemplate, SmsTemplateUpdateInput } from '../../../../lib/admin-app-settings-client';
import { adminAppSettingsQueries } from '../../../../../../shared/queryKeys/adminAppSettingsQueries';

interface UpdateVariables {
  messageCode: string;
  input: SmsTemplateUpdateInput;
}

/** Saves one SMS message's template ids and switch. No confirm dialog -- mirrors useUpdateAppSettings.ts: configuration, reversible at any time. */
export function useUpdateSmsTemplate() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();

  return useMutation<SmsTemplate, AdminAppSettingsError, UpdateVariables>({
    mutationFn: ({ messageCode, input }) => adminAppSettingsClient.updateSmsTemplate(messageCode, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminAppSettingsQueries.smsTemplates(language) });
      toast.success(t('adminSmsTemplatesUpdateSuccessToast'));
    },
  });
}

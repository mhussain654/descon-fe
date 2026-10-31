import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminAppSettingsClient } from '../../../../lib/admin-app-settings-client';
import type { AdminAppSettingsError, SmsTemplate } from '../../../../lib/admin-app-settings-client';
import { adminAppSettingsQueries } from '../../../../../../shared/queryKeys/adminAppSettingsQueries';

/** Every send.pk SMS message (the OTP and each progress SMS), in the order a candidate gets them. */
export function useSmsTemplates() {
  const { language } = useLanguage();

  return useQuery<SmsTemplate[], AdminAppSettingsError>({
    queryKey: adminAppSettingsQueries.smsTemplates(language),
    queryFn: () => adminAppSettingsClient.listSmsTemplates(),
  });
}

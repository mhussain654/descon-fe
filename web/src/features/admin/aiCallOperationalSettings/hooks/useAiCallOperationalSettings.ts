import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminAiCallOperationalSettingsClient } from '../../../../lib/admin-ai-call-operational-settings-client';
import { adminAiCallOperationalSettingQueries } from '../../../../../../shared/queryKeys/adminAiCallOperationalSettingQueries';

/** The singleton AI call operational settings row -- created lazily server-side on first access, so this always resolves to something rather than a 404. */
export function useAiCallOperationalSettings() {
  const { language } = useLanguage();

  return useQuery({
    queryKey: adminAiCallOperationalSettingQueries.get(language),
    queryFn: () => adminAiCallOperationalSettingsClient.getAiCallOperationalSettings(),
  });
}

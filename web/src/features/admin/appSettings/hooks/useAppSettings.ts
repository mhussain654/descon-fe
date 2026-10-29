import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminAppSettingsClient } from '../../../../lib/admin-app-settings-client';
import type { AdminAppSettings, AdminAppSettingsError } from '../../../../lib/admin-app-settings-client';
import { adminAppSettingsQueries } from '../../../../../../shared/queryKeys/adminAppSettingsQueries';

/** The singleton feature-switch row, created server-side with every switch on at first access. */
export function useAppSettings() {
  const { language } = useLanguage();

  return useQuery<AdminAppSettings, AdminAppSettingsError>({
    queryKey: adminAppSettingsQueries.get(language),
    queryFn: () => adminAppSettingsClient.getAppSettings(),
  });
}

import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminSupportSettingClient } from '../../../../lib/admin-support-setting-client';
import type { AdminSupportSetting, AdminSupportSettingError } from '../../../../lib/admin-support-setting-client';
import { adminSupportSettingQueries } from '../../../../../../shared/queryKeys/adminSupportSettingQueries';

/** The singleton support-number row -- created lazily server-side (blank, no default) on first access, so this always resolves to something rather than a 404. Explicit generics type the error as AdminSupportSettingError rather than TanStack Query's default `Error`, since the form reads `.code` off it. */
export function useSupportSetting() {
  const { language } = useLanguage();

  return useQuery<AdminSupportSetting, AdminSupportSettingError>({
    queryKey: adminSupportSettingQueries.get(language),
    queryFn: () => adminSupportSettingClient.getSupportSetting(),
  });
}

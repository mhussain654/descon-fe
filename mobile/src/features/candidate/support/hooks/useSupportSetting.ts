import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../contexts/AuthContext';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { supportSettingClient } from '../../../../lib/support-setting-client';
import type { SupportSetting, SupportSettingError } from '../../../../lib/support-setting-client';
import { supportSettingQueries } from '../../../../../../shared/queryKeys/supportSettingQueries';

/** Fetches the one shared support number -- mirrors useTrainingSetting exactly. Explicit generics type the error as SupportSettingError rather than TanStack Query's default `Error`, since the screen reads `.code` off it. */
export function useSupportSetting() {
  const { session, status } = useAuth();
  const { language } = useLanguage();

  return useQuery<SupportSetting, SupportSettingError>({
    queryKey: supportSettingQueries.get(language),
    queryFn: () => supportSettingClient.getSupportSetting((session as { accessToken: string }).accessToken),
    enabled: status === 'authenticated' && !!session,
    retry: false,
  });
}

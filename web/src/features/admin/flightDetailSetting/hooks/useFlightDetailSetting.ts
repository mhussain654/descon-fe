import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminFlightDetailSettingClient } from '../../../../lib/admin-flight-detail-setting-client';
import type {
  AdminFlightDetailSetting,
  AdminFlightDetailSettingError,
} from '../../../../lib/admin-flight-detail-setting-client';
import { adminFlightDetailSettingQueries } from '../../../../../../shared/queryKeys/adminFlightDetailSettingQueries';

/** The default flight details row -- created blank server-side on first access, so this always resolves. */
export function useFlightDetailSetting() {
  const { language } = useLanguage();

  return useQuery<AdminFlightDetailSetting, AdminFlightDetailSettingError>({
    queryKey: adminFlightDetailSettingQueries.get(language),
    queryFn: () => adminFlightDetailSettingClient.getFlightDetailSetting(),
  });
}

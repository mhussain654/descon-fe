import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminQvcAppointmentSettingClient } from '../../../../lib/admin-qvc-appointment-setting-client';
import type {
  AdminQvcAppointmentSetting,
  AdminQvcAppointmentSettingError,
} from '../../../../lib/admin-qvc-appointment-setting-client';
import { adminQvcAppointmentSettingQueries } from '../../../../../../shared/queryKeys/adminQvcAppointmentSettingQueries';

/**
 * The default QVC appointment row -- created blank server-side on first access, so this always resolves.
 * `enabled: false` skips the request (the QVC booking form only reads it while open).
 */
export function useQvcAppointmentSetting({ enabled = true }: { enabled?: boolean } = {}) {
  const { language } = useLanguage();

  return useQuery<AdminQvcAppointmentSetting, AdminQvcAppointmentSettingError>({
    queryKey: adminQvcAppointmentSettingQueries.get(language),
    queryFn: () => adminQvcAppointmentSettingClient.getQvcAppointmentSetting(),
    enabled,
  });
}

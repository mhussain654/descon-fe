import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminMedicalAppointmentSettingClient } from '../../../../lib/admin-medical-appointment-setting-client';
import type {
  AdminMedicalAppointmentSetting,
  AdminMedicalAppointmentSettingError,
} from '../../../../lib/admin-medical-appointment-setting-client';
import { adminMedicalAppointmentSettingQueries } from '../../../../../../shared/queryKeys/adminMedicalAppointmentSettingQueries';

/** The default medical appointment row -- created blank server-side on first access, so this always resolves. */
export function useMedicalAppointmentSetting() {
  const { language } = useLanguage();

  return useQuery<AdminMedicalAppointmentSetting, AdminMedicalAppointmentSettingError>({
    queryKey: adminMedicalAppointmentSettingQueries.get(language),
    queryFn: () => adminMedicalAppointmentSettingClient.getMedicalAppointmentSetting(),
  });
}

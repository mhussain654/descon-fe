import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { toast } from '../../../../design-system';
import { adminMedicalAppointmentSettingClient } from '../../../../lib/admin-medical-appointment-setting-client';
import type {
  AdminMedicalAppointmentSetting,
  AdminMedicalAppointmentSettingError,
  AdminMedicalAppointmentSettingUpdateInput,
} from '../../../../lib/admin-medical-appointment-setting-client';
import { adminMedicalAppointmentSettingQueries } from '../../../../../../shared/queryKeys/adminMedicalAppointmentSettingQueries';

/** Saves the default medical appointment. Open transition forms are refetched so they offer the new defaults. */
export function useUpdateMedicalAppointmentSetting() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();

  return useMutation<AdminMedicalAppointmentSetting, AdminMedicalAppointmentSettingError, AdminMedicalAppointmentSettingUpdateInput>({
    mutationFn: (input) => adminMedicalAppointmentSettingClient.updateMedicalAppointmentSetting(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminMedicalAppointmentSettingQueries.get(language) });
      // Prefix of workflowQueries.adminTransitions, for every candidate.
      queryClient.invalidateQueries({ queryKey: ['workflow', 'adminTransitions'] });
      toast.success(t('adminMedicalAppointmentSettingUpdateSuccessToast'));
    },
  });
}

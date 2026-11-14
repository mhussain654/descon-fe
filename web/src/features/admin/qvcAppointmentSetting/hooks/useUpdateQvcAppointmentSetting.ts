import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { toast } from '../../../../design-system';
import { adminQvcAppointmentSettingClient } from '../../../../lib/admin-qvc-appointment-setting-client';
import type {
  AdminQvcAppointmentSetting,
  AdminQvcAppointmentSettingError,
  AdminQvcAppointmentSettingUpdateInput,
} from '../../../../lib/admin-qvc-appointment-setting-client';
import { adminQvcAppointmentSettingQueries } from '../../../../../../shared/queryKeys/adminQvcAppointmentSettingQueries';

/** Saves the default QVC appointment; the QVC booking form reads it fresh each time it opens. */
export function useUpdateQvcAppointmentSetting() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();

  return useMutation<AdminQvcAppointmentSetting, AdminQvcAppointmentSettingError, AdminQvcAppointmentSettingUpdateInput>({
    mutationFn: (input) => adminQvcAppointmentSettingClient.updateQvcAppointmentSetting(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQvcAppointmentSettingQueries.get(language) });
      toast.success(t('adminQvcAppointmentSettingUpdateSuccessToast'));
    },
  });
}

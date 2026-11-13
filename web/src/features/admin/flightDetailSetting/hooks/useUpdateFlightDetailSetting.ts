import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { toast } from '../../../../design-system';
import { adminFlightDetailSettingClient } from '../../../../lib/admin-flight-detail-setting-client';
import type {
  AdminFlightDetailSetting,
  AdminFlightDetailSettingError,
  AdminFlightDetailSettingUpdateInput,
} from '../../../../lib/admin-flight-detail-setting-client';
import { adminFlightDetailSettingQueries } from '../../../../../../shared/queryKeys/adminFlightDetailSettingQueries';

/** Saves the default flight details. Open transition data is refetched so the flight dialog offers the new defaults. */
export function useUpdateFlightDetailSetting() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();

  return useMutation<AdminFlightDetailSetting, AdminFlightDetailSettingError, AdminFlightDetailSettingUpdateInput>({
    mutationFn: (input) => adminFlightDetailSettingClient.updateFlightDetailSetting(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminFlightDetailSettingQueries.get(language) });
      // Prefix of workflowQueries.adminTransitions, for every candidate.
      queryClient.invalidateQueries({ queryKey: ['workflow', 'adminTransitions'] });
      toast.success(t('adminFlightDetailSettingUpdateSuccessToast'));
    },
  });
}

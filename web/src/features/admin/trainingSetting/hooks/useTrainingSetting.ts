import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminTrainingSettingClient } from '../../../../lib/admin-training-setting-client';
import type { AdminTrainingSetting, AdminTrainingSettingError } from '../../../../lib/admin-training-setting-client';
import { adminTrainingSettingQueries } from '../../../../../../shared/queryKeys/adminTrainingSettingQueries';

/** The singleton training-link row -- created lazily server-side (with the placeholder default) on first access, so this always resolves to something rather than a 404. Explicit generics type the error as AdminTrainingSettingError rather than TanStack Query's default `Error`, since the form reads `.code` off it. */
export function useTrainingSetting() {
  const { language } = useLanguage();

  return useQuery<AdminTrainingSetting, AdminTrainingSettingError>({
    queryKey: adminTrainingSettingQueries.get(language),
    queryFn: () => adminTrainingSettingClient.getTrainingSetting(),
  });
}

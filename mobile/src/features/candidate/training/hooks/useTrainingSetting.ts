import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../contexts/AuthContext';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { trainingSettingClient } from '../../../../lib/training-setting-client';
import type { TrainingSetting, TrainingSettingError } from '../../../../lib/training-setting-client';
import { trainingSettingQueries } from '../../../../../../shared/queryKeys/trainingSettingQueries';

/** Fetches the one shared training link -- mirrors web's identical hook exactly. Explicit generics type the error as TrainingSettingError rather than TanStack Query's default `Error`, since the screen reads `.code` off it. */
export function useTrainingSetting() {
  const { session, status } = useAuth();
  const { language } = useLanguage();

  return useQuery<TrainingSetting, TrainingSettingError>({
    queryKey: trainingSettingQueries.get(language),
    queryFn: () => trainingSettingClient.getTrainingSetting((session as { accessToken: string }).accessToken),
    enabled: status === 'authenticated' && !!session,
    retry: false,
  });
}

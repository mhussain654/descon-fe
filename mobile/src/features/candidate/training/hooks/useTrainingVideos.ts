import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../contexts/AuthContext';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { getTrainingVideos } from '../../../../lib/training-videos-client';
import type { TrainingVideo } from '../../../../lib/training-videos-client';
import type { ApiError } from '../../../../lib/api-client';

export function useTrainingVideos() {
  const { session, status } = useAuth();
  const { language } = useLanguage();
  return useQuery<TrainingVideo[], ApiError>({
    queryKey: ['candidate', 'training-videos', language],
    queryFn: () => getTrainingVideos((session as { accessToken: string }).accessToken, language),
    enabled: status === 'authenticated' && !!session,
    staleTime: 60_000,
  });
}

import { apiClient } from './api-client';
import type { TrainingVideo } from '../../../shared/trainingVideos/types';
export type { TrainingVideo };

export async function getTrainingVideos(accessToken: string, language: 'en' | 'ur'): Promise<TrainingVideo[]> {
  const result = await apiClient.get<TrainingVideo[]>('/candidate/training_videos', {
    headers: { Authorization: `Bearer ${accessToken}`, 'X-Locale': language },
  });
  if (!result) throw new Error('Empty training video response');
  return result;
}

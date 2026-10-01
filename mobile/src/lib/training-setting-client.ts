// Mobile configuration for the candidate training-link client (mirrors
// web/src/lib/training-setting-client.ts exactly). Wires the real backend
// (shared/trainingSetting/realTrainingSettingClient.ts).
import { createTrainingSettingClient } from '../../../shared/trainingSetting/realTrainingSettingClient';
import type { TrainingSetting, TrainingSettingClient, TrainingSettingError, TrainingSettingErrorCode } from '../../../shared/trainingSetting/types';
import { getCachedLanguage } from '../contexts/LanguageContext';
import { apiClient } from './api-client';

export type { TrainingSetting, TrainingSettingClient, TrainingSettingError, TrainingSettingErrorCode };

export const trainingSettingClient: TrainingSettingClient = createTrainingSettingClient({
  apiClient,
  // getCachedLanguage is exported from a plain .jsx file, so TS widens its
  // return type to `string` -- see mobile/src/lib/auth-client.ts's identical comment.
  getLocale: () => getCachedLanguage() as 'en' | 'ur',
});

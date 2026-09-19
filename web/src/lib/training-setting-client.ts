// Web configuration for the candidate training-link client, wired to the
// real backend (shared/trainingSetting/realTrainingSettingClient.ts).
// Mirrors candidate-flight-detail-client.ts's locale-reading convention exactly.
import { createTrainingSettingClient } from '../../../shared/trainingSetting/realTrainingSettingClient';
import type { TrainingSetting, TrainingSettingClient, TrainingSettingError, TrainingSettingErrorCode } from '../../../shared/trainingSetting/types';
import { apiClient } from './api-client';

export type { TrainingSetting, TrainingSettingClient, TrainingSettingError, TrainingSettingErrorCode };

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Reads the same persisted key LanguageContext.tsx itself reads/writes -- see candidate-documents-client.ts's identical helper. */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const trainingSettingClient: TrainingSettingClient = createTrainingSettingClient({ apiClient, getLocale });

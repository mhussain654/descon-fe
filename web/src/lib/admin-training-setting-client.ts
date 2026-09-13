// Web configuration for the admin training-link setting client, wired to
// the real backend (shared/adminTrainingSetting/realAdminTrainingSettingClient.ts).
// Admin-only, web-only (AGENTS.md: "administrative workflows remain
// web-focused") -- there is no mobile equivalent of this file.
import { createAdminTrainingSettingClient } from '../../../shared/adminTrainingSetting/realAdminTrainingSettingClient';
import type {
  AdminTrainingSetting,
  AdminTrainingSettingClient,
  AdminTrainingSettingError,
  AdminTrainingSettingErrorCode,
  AdminTrainingSettingUpdateInput,
  TrainingSettingActorRef,
} from '../../../shared/adminTrainingSetting/types';
import { apiClient } from './api-client';
import { staffAuthClient } from './staff-auth-client';

export type {
  AdminTrainingSetting,
  AdminTrainingSettingClient,
  AdminTrainingSettingError,
  AdminTrainingSettingErrorCode,
  AdminTrainingSettingUpdateInput,
  TrainingSettingActorRef,
};

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Reads the same persisted key LanguageContext.tsx itself reads/writes -- see admin-audit-events-client.ts's identical helper. The backend localizes response messages from this header. */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const adminTrainingSettingClient: AdminTrainingSettingClient = createAdminTrainingSettingClient({
  apiClient,
  staffAuthClient,
  getLocale,
});

// Web configuration for the admin AI call operational settings client,
// wired to the real backend
// (shared/adminAiCallOperationalSettings/realAdminAiCallOperationalSettingsClient.ts).
// Admin-only, web-only (AGENTS.md: "administrative workflows remain
// web-focused") -- there is no mobile equivalent of this file.
import { createAdminAiCallOperationalSettingsClient } from '../../../shared/adminAiCallOperationalSettings/realAdminAiCallOperationalSettingsClient';
import type {
  AdminAiCallOperationalSettingsClient,
  AiCallOperationalSetting,
  AiCallOperationalSettingActorRef,
  AiCallOperationalSettingError,
  AiCallOperationalSettingErrorCode,
  AiCallOperationalSettingUpdateInput,
} from '../../../shared/adminAiCallOperationalSettings/types';
import { apiClient } from './api-client';
import { staffAuthClient } from './staff-auth-client';

export type {
  AdminAiCallOperationalSettingsClient,
  AiCallOperationalSetting,
  AiCallOperationalSettingActorRef,
  AiCallOperationalSettingError,
  AiCallOperationalSettingErrorCode,
  AiCallOperationalSettingUpdateInput,
};

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Reads the same persisted key LanguageContext.tsx itself reads/writes -- see admin-audit-events-client.ts's identical helper. The backend localizes response messages from this header. */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const adminAiCallOperationalSettingsClient: AdminAiCallOperationalSettingsClient = createAdminAiCallOperationalSettingsClient({
  apiClient,
  staffAuthClient,
  getLocale,
});

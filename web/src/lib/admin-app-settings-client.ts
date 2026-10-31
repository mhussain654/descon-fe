// Web configuration for the admin App Settings client (feature switches and SMS messages), wired to the real
// backend (shared/adminAppSettings/realAdminAppSettingsClient.ts). Admin-only,
// web-only -- there is no mobile equivalent of this file.
import { createAdminAppSettingsClient } from '../../../shared/adminAppSettings/realAdminAppSettingsClient';
import type {
  AdminAppSettings,
  AdminAppSettingsClient,
  AdminAppSettingsError,
  AdminAppSettingsUpdateInput,
  AppFeatureSwitch,
  SmsTemplate,
  SmsTemplateUpdateInput,
} from '../../../shared/adminAppSettings/types';
import { apiClient } from './api-client';
import { staffAuthClient } from './staff-auth-client';

export type {
  AdminAppSettings,
  AdminAppSettingsClient,
  AdminAppSettingsError,
  AdminAppSettingsUpdateInput,
  AppFeatureSwitch,
  SmsTemplate,
  SmsTemplateUpdateInput,
};

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Reads the same persisted key LanguageContext.tsx reads/writes -- see admin-support-setting-client.ts's identical helper. */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const adminAppSettingsClient: AdminAppSettingsClient = createAdminAppSettingsClient({
  apiClient,
  staffAuthClient,
  getLocale,
});

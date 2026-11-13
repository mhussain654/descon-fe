// Web configuration for the admin default flight details client, wired to
// the real backend (shared/adminFlightDetailSetting/realAdminFlightDetailSettingClient.ts).
// Admin-only, web-only -- there is no mobile equivalent of this file.
import { createAdminFlightDetailSettingClient } from '../../../shared/adminFlightDetailSetting/realAdminFlightDetailSettingClient';
import type {
  AdminFlightDetailSetting,
  AdminFlightDetailSettingClient,
  AdminFlightDetailSettingError,
  AdminFlightDetailSettingUpdateInput,
} from '../../../shared/adminFlightDetailSetting/types';
import { apiClient } from './api-client';
import { staffAuthClient } from './staff-auth-client';

export type {
  AdminFlightDetailSetting,
  AdminFlightDetailSettingClient,
  AdminFlightDetailSettingError,
  AdminFlightDetailSettingUpdateInput,
};

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Reads the same persisted key LanguageContext.tsx reads/writes. */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const adminFlightDetailSettingClient: AdminFlightDetailSettingClient =
  createAdminFlightDetailSettingClient({ apiClient, staffAuthClient, getLocale });

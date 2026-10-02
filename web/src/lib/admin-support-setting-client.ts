// Web configuration for the admin support-number setting client, wired to
// the real backend (shared/adminSupportSetting/realAdminSupportSettingClient.ts).
// Admin-only, web-only (AGENTS.md: "administrative workflows remain
// web-focused") -- there is no mobile equivalent of this file.
import { createAdminSupportSettingClient } from '../../../shared/adminSupportSetting/realAdminSupportSettingClient';
import type {
  AdminSupportSetting,
  AdminSupportSettingClient,
  AdminSupportSettingError,
  AdminSupportSettingErrorCode,
  AdminSupportSettingUpdateInput,
  SupportSettingActorRef,
} from '../../../shared/adminSupportSetting/types';
import { apiClient } from './api-client';
import { staffAuthClient } from './staff-auth-client';

export type {
  AdminSupportSetting,
  AdminSupportSettingClient,
  AdminSupportSettingError,
  AdminSupportSettingErrorCode,
  AdminSupportSettingUpdateInput,
  SupportSettingActorRef,
};

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Reads the same persisted key LanguageContext.tsx itself reads/writes -- see admin-audit-events-client.ts's identical helper. The backend localizes response messages from this header. */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const adminSupportSettingClient: AdminSupportSettingClient = createAdminSupportSettingClient({
  apiClient,
  staffAuthClient,
  getLocale,
});

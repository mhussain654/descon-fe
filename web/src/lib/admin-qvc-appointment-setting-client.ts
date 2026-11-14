// Web configuration for the admin default QVC appointment client, wired to
// the real backend (shared/adminQvcAppointmentSetting/realAdminQvcAppointmentSettingClient.ts).
// Admin-only, web-only -- there is no mobile equivalent of this file.
import { createAdminQvcAppointmentSettingClient } from '../../../shared/adminQvcAppointmentSetting/realAdminQvcAppointmentSettingClient';
import type {
  AdminQvcAppointmentSetting,
  AdminQvcAppointmentSettingClient,
  AdminQvcAppointmentSettingError,
  AdminQvcAppointmentSettingUpdateInput,
} from '../../../shared/adminQvcAppointmentSetting/types';
import { apiClient } from './api-client';
import { staffAuthClient } from './staff-auth-client';

export type {
  AdminQvcAppointmentSetting,
  AdminQvcAppointmentSettingClient,
  AdminQvcAppointmentSettingError,
  AdminQvcAppointmentSettingUpdateInput,
};

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Reads the same persisted key LanguageContext.tsx reads/writes. */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const adminQvcAppointmentSettingClient: AdminQvcAppointmentSettingClient =
  createAdminQvcAppointmentSettingClient({ apiClient, staffAuthClient, getLocale });

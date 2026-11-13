// Web configuration for the admin default medical appointment client, wired to
// the real backend (shared/adminMedicalAppointmentSetting/realAdminMedicalAppointmentSettingClient.ts).
// Admin-only, web-only -- there is no mobile equivalent of this file.
import { createAdminMedicalAppointmentSettingClient } from '../../../shared/adminMedicalAppointmentSetting/realAdminMedicalAppointmentSettingClient';
import type {
  AdminMedicalAppointmentSetting,
  AdminMedicalAppointmentSettingClient,
  AdminMedicalAppointmentSettingError,
  AdminMedicalAppointmentSettingUpdateInput,
} from '../../../shared/adminMedicalAppointmentSetting/types';
import { apiClient } from './api-client';
import { staffAuthClient } from './staff-auth-client';

export type {
  AdminMedicalAppointmentSetting,
  AdminMedicalAppointmentSettingClient,
  AdminMedicalAppointmentSettingError,
  AdminMedicalAppointmentSettingUpdateInput,
};

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Reads the same persisted key LanguageContext.tsx reads/writes. */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const adminMedicalAppointmentSettingClient: AdminMedicalAppointmentSettingClient =
  createAdminMedicalAppointmentSettingClient({ apiClient, staffAuthClient, getLocale });

// Web configuration for the admin candidate SMS client, wired to the real
// backend (shared/adminCandidateSms/realAdminCandidateSmsClient.ts).
// Admin-only, web-only.
import { createAdminCandidateSmsClient } from '../../../shared/adminCandidateSms/realAdminCandidateSmsClient';
import type { AdminCandidateSmsClient } from '../../../shared/adminCandidateSms/types';
import { apiClient } from './api-client';
import { staffAuthClient } from './staff-auth-client';

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Reads the same persisted key LanguageContext.tsx reads/writes; the backend localizes messages from this header. */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const adminCandidateSmsClient: AdminCandidateSmsClient = createAdminCandidateSmsClient({
  apiClient,
  staffAuthClient,
  getLocale,
});

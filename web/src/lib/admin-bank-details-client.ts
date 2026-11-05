// Web configuration for the admin bank details review client
// (shared/adminBankDetails/realAdminBankDetailsClient.ts). Admin-only, web-only.
import { createAdminBankDetailsClient } from '../../../shared/adminBankDetails/realAdminBankDetailsClient';
import type { AdminBankDetailsClient } from '../../../shared/adminBankDetails/types';
import { apiClient } from './api-client';
import { staffAuthClient } from './staff-auth-client';

const LANGUAGE_STORAGE_KEY = 'descon.language';

function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const adminBankDetailsClient: AdminBankDetailsClient = createAdminBankDetailsClient({ apiClient, staffAuthClient, getLocale });

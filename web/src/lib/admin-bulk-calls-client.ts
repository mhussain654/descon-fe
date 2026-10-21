// Web configuration for the admin bulk-call client, wired to the real backend
// (shared/adminBulkCalls/realAdminBulkCallsClient.ts). Admin-only, web-only
// (AGENTS.md: "administrative workflows remain web-focused").
import { createAdminBulkCallsClient } from '../../../shared/adminBulkCalls/realAdminBulkCallsClient';
import type { AdminBulkCallsClient } from '../../../shared/adminBulkCalls/types';
import { apiClient } from './api-client';
import { staffAuthClient } from './staff-auth-client';

export type * from '../../../shared/adminBulkCalls/types';

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Reads the same persisted key LanguageContext.tsx itself reads/writes -- the backend localizes response messages from this header. */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const adminBulkCallsClient: AdminBulkCallsClient = createAdminBulkCallsClient({ apiClient, staffAuthClient, getLocale });

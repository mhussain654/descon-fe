// Web configuration for the staff directory / role-admin client, wired to
// the real MPS-205 backend (shared/staffAdmin/realStaffDirectoryClient.ts).
// Admin-only, web-only (AGENTS.md: "administrative workflows remain
// web-focused") -- there is no mobile equivalent of this file. Same
// unconditional-real pattern as admin-payments-client.ts -- no dev/prod
// mock branch (AGENTS.md: "Never silently fall back to mock data in
// production").
import { createStaffDirectoryClient } from '../../../shared/staffAdmin/realStaffDirectoryClient';
import type { StaffDirectoryClient } from '../../../shared/staffAdmin/types';
import { apiClient } from './api-client';
import { staffAuthClient } from './staff-auth-client';

export type { StaffDirectoryClient, StaffDirectoryListParams, StaffInviteInput, StaffMember } from '../../../shared/staffAdmin/types';

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Reads the same persisted key LanguageContext.tsx itself reads/writes -- see admin-payments-client.ts's identical helper. The backend localizes response messages from this header. */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const staffDirectoryClient: StaffDirectoryClient = createStaffDirectoryClient({
  apiClient,
  staffAuthClient,
  getLocale,
});

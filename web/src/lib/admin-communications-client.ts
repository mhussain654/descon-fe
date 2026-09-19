// Web configuration for the admin communications log client, wired to the
// real backend (shared/adminCommunications/realAdminCommunicationsClient.ts).
// Admin-only, web-only (AGENTS.md: "administrative workflows remain
// web-focused") -- there is no mobile equivalent of this file.
import { createAdminCommunicationsClient } from '../../../shared/adminCommunications/realAdminCommunicationsClient';
import type {
  AdminCommunicationsClient,
  Communication,
  CommunicationActorRef,
  CommunicationAssignmentRef,
  CommunicationError,
  CommunicationErrorCode,
  CommunicationListFilters,
  CommunicationListPage,
  CommunicationListPagination,
  CommunicationListResult,
  CommunicationListSort,
} from '../../../shared/adminCommunications/types';
import { apiClient } from './api-client';
import { staffAuthClient } from './staff-auth-client';

export type {
  AdminCommunicationsClient,
  Communication,
  CommunicationActorRef,
  CommunicationAssignmentRef,
  CommunicationError,
  CommunicationErrorCode,
  CommunicationListFilters,
  CommunicationListPage,
  CommunicationListPagination,
  CommunicationListResult,
  CommunicationListSort,
};

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Reads the same persisted key LanguageContext.tsx itself reads/writes -- see admin-audit-events-client.ts's identical helper. The backend localizes response messages from this header. */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const adminCommunicationsClient: AdminCommunicationsClient = createAdminCommunicationsClient({
  apiClient,
  staffAuthClient,
  getLocale,
});

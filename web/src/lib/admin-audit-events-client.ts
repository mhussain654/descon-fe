// Web configuration for the admin audit explorer client, wired to the real
// backend (shared/adminAuditEvents/realAdminAuditEventsClient.ts).
// Admin-only, web-only (AGENTS.md: "administrative workflows remain
// web-focused") -- there is no mobile equivalent of this file.
import { createAdminAuditEventsClient } from '../../../shared/adminAuditEvents/realAdminAuditEventsClient';
import type {
  AdminAuditEventsClient,
  AuditEvent,
  AuditEventActorRef,
  AuditEventError,
  AuditEventErrorCode,
  AuditEventListFilters,
  AuditEventListPage,
  AuditEventListPagination,
  AuditEventListResult,
  AuditEventListSort,
} from '../../../shared/adminAuditEvents/types';
import { apiClient } from './api-client';
import { staffAuthClient } from './staff-auth-client';

export type {
  AdminAuditEventsClient,
  AuditEvent,
  AuditEventActorRef,
  AuditEventError,
  AuditEventErrorCode,
  AuditEventListFilters,
  AuditEventListPage,
  AuditEventListPagination,
  AuditEventListResult,
  AuditEventListSort,
};

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Reads the same persisted key LanguageContext.tsx itself reads/writes -- see admin-payments-client.ts's identical helper. The backend localizes response messages from this header. */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const adminAuditEventsClient: AdminAuditEventsClient = createAdminAuditEventsClient({
  apiClient,
  staffAuthClient,
  getLocale,
});

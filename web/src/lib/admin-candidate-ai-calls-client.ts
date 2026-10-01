// Web configuration for the admin candidate AI call client, wired to the
// real backend (shared/adminCandidateAiCalls/realAdminCandidateAiCallsClient.ts).
// Admin-only, web-only (AGENTS.md: "administrative workflows remain
// web-focused") -- there is no mobile equivalent of this file.
import { createAdminCandidateAiCallsClient } from '../../../shared/adminCandidateAiCalls/realAdminCandidateAiCallsClient';
import type {
  AdminAiCallActorRef,
  AdminAiCallDirection,
  AdminAiCallOutcome,
  AdminAiCallReason,
  AdminAiCallStatus,
  AdminAiCallVerificationStatus,
  AdminCandidateAiCall,
  AdminCandidateAiCallError,
  AdminCandidateAiCallErrorCode,
  AdminCandidateAiCallsClient,
} from '../../../shared/adminCandidateAiCalls/types';
import { apiClient } from './api-client';
import { staffAuthClient } from './staff-auth-client';

export type {
  AdminAiCallActorRef,
  AdminAiCallDirection,
  AdminAiCallOutcome,
  AdminAiCallReason,
  AdminAiCallStatus,
  AdminAiCallVerificationStatus,
  AdminCandidateAiCall,
  AdminCandidateAiCallError,
  AdminCandidateAiCallErrorCode,
  AdminCandidateAiCallsClient,
};

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Reads the same persisted key LanguageContext.tsx itself reads/writes -- see admin-audit-events-client.ts's identical helper. The backend localizes response messages from this header. */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const adminCandidateAiCallsClient: AdminCandidateAiCallsClient = createAdminCandidateAiCallsClient({
  apiClient,
  staffAuthClient,
  getLocale,
});

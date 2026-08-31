// Web configuration for the admin candidate creation/detail/profile-editing
// client (MPS-F301), wired to the real backend
// (shared/adminCandidates/realAdminCandidateClient.ts).
import { createAdminCandidateClient } from '../../../shared/adminCandidates/realAdminCandidateClient';
import type {
  AdminCandidateAssignmentSummary,
  AdminCandidateClient,
  AdminCandidateDetail,
  AdminCandidateError,
  AdminCandidateErrorCode,
  CreateCandidateInput,
  ReferenceDataItem,
  UpdateCandidateInput,
} from '../../../shared/adminCandidates/types';
import { apiClient } from './api-client';
import { staffAuthClient } from './staff-auth-client';

export type {
  AdminCandidateAssignmentSummary,
  AdminCandidateClient,
  AdminCandidateDetail,
  AdminCandidateError,
  AdminCandidateErrorCode,
  CreateCandidateInput,
  ReferenceDataItem,
  UpdateCandidateInput,
};

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Reads the same persisted key LanguageContext.tsx itself reads/writes -- same helper as admin-workflow-client.ts. */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const adminCandidateClient: AdminCandidateClient = createAdminCandidateClient({
  apiClient,
  staffAuthClient,
  getLocale,
});

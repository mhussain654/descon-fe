// Web configuration for the developer-only workflow corrections client, wired
// to the real backend (shared/adminWorkflowCorrections/realWorkflowCorrectionsClient.ts).
import { createWorkflowCorrectionsClient } from '../../../shared/adminWorkflowCorrections/realWorkflowCorrectionsClient';
import type { WorkflowCorrectionsClient } from '../../../shared/adminWorkflowCorrections/types';
import { apiClient } from './api-client';
import { staffAuthClient } from './staff-auth-client';

export type * from '../../../shared/adminWorkflowCorrections/types';

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Reads the same persisted key LanguageContext.tsx reads/writes. */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const adminWorkflowCorrectionsClient: WorkflowCorrectionsClient = createWorkflowCorrectionsClient({
  apiClient,
  staffAuthClient,
  getLocale,
});

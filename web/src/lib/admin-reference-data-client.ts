// Web configuration for the reference data client (shared/adminReferenceData).
import { createReferenceDataClient } from '../../../shared/adminReferenceData/realReferenceDataClient';
import type { ReferenceDataClient } from '../../../shared/adminReferenceData/types';
import { apiClient } from './api-client';
import { staffAuthClient } from './staff-auth-client';

export type * from '../../../shared/adminReferenceData/types';

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Same persisted key LanguageContext reads; the backend localizes messages from it. */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const adminReferenceDataClient: ReferenceDataClient = createReferenceDataClient({ apiClient, staffAuthClient, getLocale });

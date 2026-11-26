// Web configuration for the campaign client (shared/adminCampaigns).
import { createCampaignClient } from '../../../shared/adminCampaigns/realCampaignClient';
import type { CampaignClient } from '../../../shared/adminCampaigns/types';
import { apiClient } from './api-client';
import { staffAuthClient } from './staff-auth-client';

export type { Campaign, CampaignClient, CampaignCreateInput, CampaignError } from '../../../shared/adminCampaigns/types';

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Same persisted key LanguageContext reads; the backend localizes messages from it. */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const adminCampaignClient: CampaignClient = createCampaignClient({ apiClient, staffAuthClient, getLocale });

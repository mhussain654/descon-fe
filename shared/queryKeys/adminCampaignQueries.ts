// Query keys for campaigns and the staff member's running campaign.
import type { Language } from '../i18n/translations';

export const adminCampaignQueries = {
  all: ['adminCampaigns'] as const,
  list: (locale: Language, includeRetired: boolean) => ['adminCampaigns', 'list', locale, includeRetired] as const,
  running: (staffId: string) => ['adminRunningCampaign', staffId] as const,
};

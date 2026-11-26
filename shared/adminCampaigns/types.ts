// Campaign types, wired to the backend documented in descon-be's openapi.yaml:
//   GET   /api/v1/admin/campaigns
//   POST  /api/v1/admin/campaigns
//   GET   /api/v1/users/profile    (selected_campaign: the running campaign)
//   PATCH /api/v1/users/profile    (sets the running campaign)
//
// A campaign is a group of candidates handled together (e.g. "Quarterly
// payment"). A staff member's running campaign narrows every candidate list,
// dashboard and report in admin; none means all campaigns (the Test campaign
// is left out). Web-only (AGENTS.md: "administrative workflows remain web-focused").

export type CampaignKind = 'regular' | 'test';

export interface Campaign {
  id: string;
  /** e.g. "2026-11-26-QATAR". */
  code: string;
  name: string;
  kind: CampaignKind;
  /** Null only for the Test campaign. */
  country: { code: string; name: string } | null;
  active: boolean;
  createdAt: string;
  /** Candidates in the campaign, when listed. */
  candidateCount?: number;
}

export interface CampaignCreateInput {
  name: string;
  countryCode: string;
  /** ISO date; defaults to today. */
  startDate?: string;
}

export type CampaignErrorCode =
  | 'VALIDATION_FAILED'
  | 'FORBIDDEN'
  | 'INACTIVE_ACCOUNT'
  | 'SESSION_EXPIRED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface CampaignError {
  code: CampaignErrorCode;
  /** Already-localized server message, when the backend provided one. */
  message?: string;
  field?: string;
}

export interface CampaignClient {
  listCampaigns(options?: { includeRetired?: boolean }): Promise<Campaign[]>;
  createCampaign(input: CampaignCreateInput): Promise<Campaign>;
  /** The signed-in staff member's running campaign, or null for all campaigns. */
  getRunningCampaign(): Promise<Campaign | null>;
  /** Saves the running campaign (null = all campaigns) and returns it. */
  setRunningCampaign(campaignId: string | null): Promise<Campaign | null>;
}

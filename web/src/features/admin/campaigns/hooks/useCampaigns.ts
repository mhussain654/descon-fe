import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import { adminCampaignClient } from '../../../../lib/admin-campaigns-client';
import type { Campaign, CampaignCreateInput, CampaignError } from '../../../../lib/admin-campaigns-client';
import { adminCampaignQueries } from '../../../../../../shared/queryKeys/adminCampaignQueries';

/** Active campaigns (the Test campaign first, then the newest) with their candidate counts. */
export function useCampaigns({ includeRetired = false }: { includeRetired?: boolean } = {}) {
  const { language } = useLanguage();
  return useQuery<Campaign[], CampaignError>({
    queryKey: adminCampaignQueries.list(language, includeRetired),
    queryFn: () => adminCampaignClient.listCampaigns({ includeRetired }),
  });
}

/** The signed-in staff member's running campaign; null means all campaigns. */
export function useRunningCampaign() {
  const { session } = useStaffAuth();
  return useQuery<Campaign | null, CampaignError>({
    queryKey: adminCampaignQueries.running(session?.staffId ?? 'anonymous'),
    queryFn: () => adminCampaignClient.getRunningCampaign(),
    enabled: !!session,
    staleTime: 60_000,
  });
}

/**
 * The campaign a new import or candidate starts in: the running campaign, else
 * the latest regular campaign. Undefined while still loading.
 */
export function useDefaultCampaign(): Campaign | null | undefined {
  const running = useRunningCampaign();
  const campaigns = useCampaigns();
  if (running.data === undefined || campaigns.data === undefined) return undefined;
  return running.data ?? campaigns.data.find((campaign) => campaign.kind === 'regular') ?? null;
}

/** Saves the running campaign, then refetches everything: candidate lists, dashboards and reports follow it. */
export function useSetRunningCampaign() {
  const queryClient = useQueryClient();
  const { session } = useStaffAuth();
  return useMutation<Campaign | null, CampaignError, string | null>({
    mutationFn: (campaignId) => adminCampaignClient.setRunningCampaign(campaignId),
    onSuccess: async (campaign) => {
      queryClient.setQueryData(adminCampaignQueries.running(session?.staffId ?? 'anonymous'), campaign);
      await queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== 'adminRunningCampaign' });
    },
  });
}

/** Creates a campaign and refreshes the campaign lists. */
export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation<Campaign, CampaignError, CampaignCreateInput>({
    mutationFn: (input) => adminCampaignClient.createCampaign(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminCampaignQueries.all }),
  });
}

import { Layers } from 'lucide-react';
import { Link } from 'react-router';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { Card, Select, ValidationMessage } from '../../../../design-system';
import { interpolate } from '../../../../../../shared/i18n/interpolate';
import type { Campaign } from '../../../../lib/admin-campaigns-client';
import { useCampaigns, useRunningCampaign, useSetRunningCampaign } from '../hooks/useCampaigns';

const ALL_CAMPAIGNS = '';

/** "Quarterly payment (2026-11-26-QATAR)", or just the name when it is the code. */
export function campaignLabel(campaign: Pick<Campaign, 'name' | 'code'>): string {
  return campaign.name === campaign.code ? campaign.name : `${campaign.name} (${campaign.code})`;
}

/**
 * Profile card for choosing the running campaign. It is saved on the staff
 * account, so it stays across sign-ins and devices until changed here; every
 * candidate list, dashboard and report follows it.
 */
export function RunningCampaignPicker() {
  const { t } = useLanguage();
  const running = useRunningCampaign();
  const campaigns = useCampaigns();
  const setRunning = useSetRunningCampaign();

  const options = [
    { value: ALL_CAMPAIGNS, label: t('workingCampaignAll') },
    ...(campaigns.data ?? []).map((campaign) => ({
      value: campaign.id,
      label: `${campaignLabel(campaign)} · ${interpolate(t('workingCampaignCandidateCount'), { count: campaign.candidateCount ?? 0 })}`,
    })),
  ];

  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold text-text-primary">{t('workingCampaignTitle')}</h2>
      <p className="mb-4 text-sm text-text-secondary">{t('workingCampaignDescription')}</p>
      <Select
        label={t('workingCampaignLabel')}
        value={running.data?.id ?? ALL_CAMPAIGNS}
        disabled={running.isPending || campaigns.isPending || setRunning.isPending}
        onChange={(event) => setRunning.mutate(event.target.value || null)}
        options={options}
        helperText={setRunning.isPending ? t('workingCampaignSaving') : t('workingCampaignHelper')}
      />
      {setRunning.isError || campaigns.isError ? (
        <div className="mt-3">
          <ValidationMessage tone="error">{setRunning.error?.message ?? t('workingCampaignError')}</ValidationMessage>
        </div>
      ) : null}
    </Card>
  );
}

/** Header switch: the running campaign (or "All campaigns"), linking to the profile to change it. */
export function RunningCampaignBadge() {
  const { t } = useLanguage();
  const running = useRunningCampaign();
  const campaign = running.data;
  const tone = campaign?.kind === 'test'
    ? 'bg-warning-subtle text-warning-emphasis'
    : campaign
      ? 'bg-info-subtle text-info-emphasis'
      : 'bg-surface-sunken text-text-secondary';

  return (
    <Link
      to="/admin/profile"
      aria-label={t('workingCampaignChange')}
      title={t('workingCampaignChange')}
      className={`flex max-w-[16rem] items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-opacity hover:opacity-80 ${tone}`}
    >
      <Layers className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{campaign ? campaignLabel(campaign) : t('workingCampaignAll')}</span>
    </Link>
  );
}

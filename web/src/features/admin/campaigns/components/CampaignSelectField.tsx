import { useEffect, useState } from 'react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { Button, Dialog, DialogContent, DialogFooter, HelperText, Input, Select, ValidationMessage } from '../../../../design-system';
import { useCountries } from '../../candidates/hooks/useReferenceData';
import type { Campaign } from '../../../../lib/admin-campaigns-client';
import { useCampaigns, useCreateCampaign } from '../hooks/useCampaigns';
import { campaignLabel } from './RunningCampaign';

interface CampaignSelectFieldProps {
  value: string;
  /** The picked campaign (null when cleared), so callers can follow its country. */
  onChange: (campaign: Campaign | null) => void;
  errorMessage?: string;
  helperText?: string;
  disabled?: boolean;
}

/**
 * Required campaign for an import or a new candidate: pick an active campaign,
 * or create one in a pop-up and use it straight away.
 */
export function CampaignSelectField({ value, onChange, errorMessage, helperText, disabled }: CampaignSelectFieldProps) {
  const { t } = useLanguage();
  const campaigns = useCampaigns();
  const [creating, setCreating] = useState(false);
  const list = campaigns.data ?? [];

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <Select
            label={t('adminCampaignFieldLabel')}
            value={value}
            disabled={disabled || campaigns.isPending}
            onChange={(event) => onChange(list.find((campaign) => campaign.id === event.target.value) ?? null)}
            options={[
              { value: '', label: t('adminCampaignSelectPlaceholder') },
              ...list.map((campaign) => ({ value: campaign.id, label: campaignLabel(campaign) })),
            ]}
            errorMessage={errorMessage}
          />
        </div>
        <Button type="button" variant="secondary" onClick={() => setCreating(true)} disabled={disabled}>
          {t('adminCampaignNewAction')}
        </Button>
      </div>
      {!errorMessage && helperText ? (
        <div className="mt-1">
          <HelperText>{helperText}</HelperText>
        </div>
      ) : null}
      <NewCampaignDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(campaign) => {
          setCreating(false);
          onChange(campaign);
        }}
      />
    </div>
  );
}

function todayIso(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

interface NewCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (campaign: Campaign) => void;
}

/** "New campaign" pop-up: name first, then country and start date. */
export function NewCampaignDialog({ open, onOpenChange, onCreated }: NewCampaignDialogProps) {
  const { t } = useLanguage();
  const countries = useCountries();
  const create = useCreateCampaign();
  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [startDate, setStartDate] = useState(todayIso);
  const [errors, setErrors] = useState<{ name?: string; countryCode?: string }>({});

  useEffect(() => {
    if (!open) return;
    setName('');
    setCountryCode('');
    setStartDate(todayIso());
    setErrors({});
    create.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset the form each time it opens
  }, [open]);

  const serverFieldError = (field: string) => (create.error?.field === field ? create.error.message : undefined);

  const submit = () => {
    const next = {
      name: name.trim() ? undefined : t('adminCampaignNameRequiredError'),
      countryCode: countryCode ? undefined : t('adminCandidateCountryRequiredError'),
    };
    setErrors(next);
    if (next.name || next.countryCode) return;
    create.mutate({ name, countryCode, startDate }, { onSuccess: onCreated });
  };

  const generalError = create.isError && !create.error?.field?.startsWith('campaign.') ? create.error?.message ?? t('adminCampaignCreateError') : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t('adminCampaignNewTitle')} description={t('adminCampaignNewDescription')} closeLabel={t('adminCampaignCancel')}>
        <div className="space-y-4">
          <Input
            label={t('adminCampaignNameLabel')}
            value={name}
            maxLength={120}
            placeholder={t('adminCampaignNamePlaceholder')}
            onChange={(event) => setName(event.target.value)}
            errorMessage={errors.name ?? serverFieldError('campaign.name')}
            autoFocus
          />
          <Select
            label={t('adminCampaignCountryLabel')}
            value={countryCode}
            onChange={(event) => setCountryCode(event.target.value)}
            options={[
              { value: '', label: t('adminCampaignCountryPlaceholder') },
              ...(countries.data ?? []).map((country) => ({ value: country.code, label: country.name })),
            ]}
            errorMessage={errors.countryCode ?? serverFieldError('campaign.country_code')}
          />
          <Input
            label={t('adminCampaignDateLabel')}
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            errorMessage={serverFieldError('campaign.start_date')}
          />
          {generalError ? <ValidationMessage tone="error">{generalError}</ValidationMessage> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={create.isPending}>
            {t('adminCampaignCancel')}
          </Button>
          <Button type="button" onClick={submit} loading={create.isPending} disabled={create.isPending}>
            {t('adminCampaignCreateAction')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

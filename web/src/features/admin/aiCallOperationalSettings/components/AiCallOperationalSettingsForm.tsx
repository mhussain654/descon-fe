import { useEffect, useState } from 'react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import { Button, Card, ErrorState, ForbiddenState, HelperText, Input, LoadingState, OfflineState, ValidationMessage } from '../../../../design-system';
import { formatDate } from '../../../../../../shared/i18n/locale';
import type { AiCallOperationalSetting } from '../../../../lib/admin-ai-call-operational-settings-client';
import { useAiCallOperationalSettings } from '../hooks/useAiCallOperationalSettings';
import { useUpdateAiCallOperationalSettings } from '../hooks/useUpdateAiCallOperationalSettings';
import { Clock3, Gauge, PhoneCall, Save, ShieldCheck } from 'lucide-react';

/** A settings field's controlled string state -- empty string represents "unset" (null server-side, falls back to the ENV default), distinct from any numeric value including 0. */
type FieldState = Record<
  'outboundTriggerCooldownMinutes' | 'dailyOutboundCallLimit' | 'adminTriggerRateLimitPerHour' | 'callingHoursStart' | 'callingHoursEnd' | 'maxCallDurationMinutes',
  string
>;

function toFieldState(settings: AiCallOperationalSetting): FieldState {
  const toStr = (value: number | null) => (value === null ? '' : String(value));
  return {
    outboundTriggerCooldownMinutes: toStr(settings.outboundTriggerCooldownMinutes),
    dailyOutboundCallLimit: toStr(settings.dailyOutboundCallLimit),
    adminTriggerRateLimitPerHour: toStr(settings.adminTriggerRateLimitPerHour),
    callingHoursStart: toStr(settings.callingHoursStart),
    callingHoursEnd: toStr(settings.callingHoursEnd),
    maxCallDurationMinutes: toStr(settings.maxCallDurationMinutes),
  };
}

function toNullableInt(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

/** The AI call rate-limit / calling-hours singleton settings form (MPS-712/MPS-F706). Always directly editable -- unlike WorkflowStageCallScriptRow's per-row view/edit toggle, this page has nothing else to show, so there is no separate "view mode" worth the extra click. */
export function AiCallOperationalSettingsForm() {
  const { t, language } = useLanguage();
  const { signOut } = useStaffAuth();
  const query = useAiCallOperationalSettings();
  const mutation = useUpdateAiCallOperationalSettings();
  const [fields, setFields] = useState<FieldState | null>(null);

  useEffect(() => {
    if (query.data && fields === null) setFields(toFieldState(query.data));
  }, [query.data, fields]);

  useEffect(() => {
    const code = query.error?.code ?? mutation.error?.code;
    if (code === 'SESSION_EXPIRED') signOut('expired');
    else if (code === 'INACTIVE_ACCOUNT') signOut('manual');
  }, [query.error, mutation.error, signOut]);

  if (query.isLoading) {
    return <LoadingState message={t('loading')} />;
  }

  if (query.isError) {
    const error = query.error;
    if (error?.code === 'OFFLINE') {
      return (
        <OfflineState title={t('dsOfflineTitle')} description={t('dsOfflineDescription')} retryLabel={t('retry')} onRetry={() => query.refetch()} />
      );
    }
    if (error?.code === 'FORBIDDEN') {
      return <ForbiddenState title={t('dsForbiddenTitle')} description={t('dsForbiddenDescription')} />;
    }
    if (error?.code === 'SESSION_EXPIRED' || error?.code === 'INACTIVE_ACCOUNT') {
      return null;
    }
    return <ErrorState message={error?.message || t('somethingWentWrong')} retryLabel={t('retry')} onRetry={() => query.refetch()} />;
  }

  if (!fields || !query.data) return null;

  const settings = query.data;
  const setField = (key: keyof FieldState) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setFields((current) => (current ? { ...current, [key]: event.target.value } : current));

  const handleSave = () => {
    mutation.mutate({
      outboundTriggerCooldownMinutes: toNullableInt(fields.outboundTriggerCooldownMinutes),
      dailyOutboundCallLimit: toNullableInt(fields.dailyOutboundCallLimit),
      adminTriggerRateLimitPerHour: toNullableInt(fields.adminTriggerRateLimitPerHour),
      callingHoursStart: toNullableInt(fields.callingHoursStart),
      callingHoursEnd: toNullableInt(fields.callingHoursEnd),
      maxCallDurationMinutes: toNullableInt(fields.maxCallDurationMinutes),
    });
  };

  const errorMessage = mutation.isError && mutation.error.code === 'VALIDATION_FAILED' ? mutation.error.message : undefined;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SettingSummary icon={PhoneCall} label={t('adminAiCallSettingsDailySummary')} value={fields.dailyOutboundCallLimit || t('adminAiCallSettingsDefaultPlaceholder')} className="border-t-brand bg-brand-subtle/45 text-brand" />
        <SettingSummary icon={Clock3} label={t('adminAiCallSettingsWindowSummary')} value={fields.callingHoursStart && fields.callingHoursEnd ? `${fields.callingHoursStart}:00–${fields.callingHoursEnd}:00` : t('adminAiCallSettingsDefaultPlaceholder')} className="border-t-info bg-info-subtle/55 text-info-emphasis" />
        <SettingSummary icon={ShieldCheck} label={t('adminAiCallSettingsDurationSummary')} value={fields.maxCallDurationMinutes ? `${fields.maxCallDurationMinutes} ${t('adminAiCallSettingsMinutesShort')}` : t('adminAiCallSettingsDefaultPlaceholder')} className="border-t-success bg-success-subtle/55 text-success-emphasis" />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border-subtle bg-surface-sunken px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-subtle text-brand"><Gauge className="h-4 w-4" aria-hidden="true" /></span>
          <div>
            <h2 className="font-semibold text-text-primary">{t('adminAiCallSettingsLimitsTitle')}</h2>
            <p className="text-xs text-text-secondary">{t('adminAiCallSettingsLimitsDescription')}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <Input
            type="number"
            min={0}
            label={t('adminAiCallSettingsCooldownLabel')}
            placeholder={t('adminAiCallSettingsDefaultPlaceholder')}
            helperText={t('adminAiCallSettingsDefaultHint')}
            value={fields.outboundTriggerCooldownMinutes}
            onChange={setField('outboundTriggerCooldownMinutes')}
          />
          <Input
            type="number"
            min={0}
            label={t('adminAiCallSettingsDailyLimitLabel')}
            placeholder={t('adminAiCallSettingsDefaultPlaceholder')}
            helperText={t('adminAiCallSettingsDefaultHint')}
            value={fields.dailyOutboundCallLimit}
            onChange={setField('dailyOutboundCallLimit')}
          />
          <Input
            type="number"
            min={0}
            label={t('adminAiCallSettingsAdminRateLimitLabel')}
            placeholder={t('adminAiCallSettingsDefaultPlaceholder')}
            helperText={t('adminAiCallSettingsDefaultHint')}
            value={fields.adminTriggerRateLimitPerHour}
            onChange={setField('adminTriggerRateLimitPerHour')}
          />
          <Input
            type="number"
            min={0}
            label={t('adminAiCallSettingsMaxDurationLabel')}
            placeholder={t('adminAiCallSettingsDefaultPlaceholder')}
            helperText={t('adminAiCallSettingsDefaultHint')}
            value={fields.maxCallDurationMinutes}
            onChange={setField('maxCallDurationMinutes')}
          />
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border-subtle bg-surface-sunken px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-info-subtle text-info-emphasis"><Clock3 className="h-4 w-4" aria-hidden="true" /></span>
          <div>
            <h2 className="font-semibold text-text-primary">{t('adminAiCallSettingsCallingWindowTitle')}</h2>
            <p className="text-xs text-text-secondary">{t('adminAiCallSettingsCallingWindowDescription')}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <Input
            type="number"
            min={0}
            max={23}
            label={t('adminAiCallSettingsCallingHoursStartLabel')}
            placeholder={t('adminAiCallSettingsDefaultPlaceholder')}
            helperText={t('adminAiCallSettingsDefaultHint')}
            value={fields.callingHoursStart}
            onChange={setField('callingHoursStart')}
          />
          <Input
            type="number"
            min={0}
            max={23}
            label={t('adminAiCallSettingsCallingHoursEndLabel')}
            placeholder={t('adminAiCallSettingsDefaultPlaceholder')}
            helperText={t('adminAiCallSettingsDefaultHint')}
            value={fields.callingHoursEnd}
            onChange={setField('callingHoursEnd')}
          />
        </div>
      </Card>

      {errorMessage ? <ValidationMessage>{errorMessage}</ValidationMessage> : null}

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <HelperText>
            {t('adminAiCallSettingsUpdatedBy')}:{' '}
            {settings.updatedBy ? `${settings.updatedBy.role} (${settings.updatedBy.id})` : t('adminCommunicationSystemActor')} ·{' '}
            {formatDate(settings.updatedAt, language, { dateStyle: 'medium', timeStyle: 'short' })}
          </HelperText>
          <Button onClick={handleSave} loading={mutation.isPending}>
            <Save className="me-1.5 h-4 w-4" aria-hidden="true" />
            {t('adminAiCallSettingsSaveAction')}
          </Button>
      </Card>
    </div>
  );
}

function SettingSummary({ icon: Icon, label, value, className }: { icon: typeof PhoneCall; label: string; value: string; className: string }) {
  return (
    <div className={`rounded-xl border border-border border-t-4 p-4 shadow-sm ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{label}</span>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="truncate text-lg font-semibold tracking-tight text-text-primary">{value}</div>
    </div>
  );
}

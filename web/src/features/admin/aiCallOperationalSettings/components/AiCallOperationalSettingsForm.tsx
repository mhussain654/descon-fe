import { useEffect, useState } from 'react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import { Button, Card, ErrorState, ForbiddenState, HelperText, Input, LoadingState, OfflineState, ValidationMessage } from '../../../../design-system';
import { formatDate } from '../../../../../../shared/i18n/locale';
import type { AiCallOperationalSetting } from '../../../../lib/admin-ai-call-operational-settings-client';
import { useAiCallOperationalSettings } from '../hooks/useAiCallOperationalSettings';
import { useUpdateAiCallOperationalSettings } from '../hooks/useUpdateAiCallOperationalSettings';

/** A settings field's controlled string state -- empty string represents "unset" (null server-side, falls back to the ENV default), distinct from any numeric value including 0. */
type FieldState = Record<
  'outboundTriggerCooldownMinutes' | 'dailyOutboundCallLimit' | 'adminTriggerRateLimitPerHour' | 'callingHoursStart' | 'callingHoursEnd' | 'maxCallDurationMinutes',
  string
>;

/**
 * Mirrors AiCalls::Configuration's own ENV fallback defaults exactly
 * (descon-be/app/services/ai_calls/configuration.rb) -- shown so an admin
 * knows what a blank field actually resolves to, not just that "some
 * default" applies. Update this map if those backend defaults ever change.
 */
const PLATFORM_DEFAULTS: Record<keyof FieldState, number> = {
  outboundTriggerCooldownMinutes: 60,
  dailyOutboundCallLimit: 200,
  adminTriggerRateLimitPerHour: 50,
  callingHoursStart: 9,
  callingHoursEnd: 19,
  maxCallDurationMinutes: 15,
};

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
  const defaultHint = (key: keyof FieldState) => `${t('adminAiCallSettingsDefaultHintPrefix')} ${PLATFORM_DEFAULTS[key]}`;

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
    <Card>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            type="number"
            min={0}
            label={t('adminAiCallSettingsCooldownLabel')}
            placeholder={String(PLATFORM_DEFAULTS.outboundTriggerCooldownMinutes)}
            helperText={defaultHint('outboundTriggerCooldownMinutes')}
            value={fields.outboundTriggerCooldownMinutes}
            onChange={setField('outboundTriggerCooldownMinutes')}
          />
          <Input
            type="number"
            min={0}
            label={t('adminAiCallSettingsDailyLimitLabel')}
            placeholder={String(PLATFORM_DEFAULTS.dailyOutboundCallLimit)}
            helperText={defaultHint('dailyOutboundCallLimit')}
            value={fields.dailyOutboundCallLimit}
            onChange={setField('dailyOutboundCallLimit')}
          />
          <Input
            type="number"
            min={0}
            label={t('adminAiCallSettingsAdminRateLimitLabel')}
            placeholder={String(PLATFORM_DEFAULTS.adminTriggerRateLimitPerHour)}
            helperText={defaultHint('adminTriggerRateLimitPerHour')}
            value={fields.adminTriggerRateLimitPerHour}
            onChange={setField('adminTriggerRateLimitPerHour')}
          />
          <Input
            type="number"
            min={0}
            label={t('adminAiCallSettingsMaxDurationLabel')}
            placeholder={String(PLATFORM_DEFAULTS.maxCallDurationMinutes)}
            helperText={defaultHint('maxCallDurationMinutes')}
            value={fields.maxCallDurationMinutes}
            onChange={setField('maxCallDurationMinutes')}
          />
          <Input
            type="number"
            min={0}
            max={23}
            label={t('adminAiCallSettingsCallingHoursStartLabel')}
            placeholder={String(PLATFORM_DEFAULTS.callingHoursStart)}
            helperText={defaultHint('callingHoursStart')}
            value={fields.callingHoursStart}
            onChange={setField('callingHoursStart')}
          />
          <Input
            type="number"
            min={0}
            max={23}
            label={t('adminAiCallSettingsCallingHoursEndLabel')}
            placeholder={String(PLATFORM_DEFAULTS.callingHoursEnd)}
            helperText={defaultHint('callingHoursEnd')}
            value={fields.callingHoursEnd}
            onChange={setField('callingHoursEnd')}
          />
        </div>

        {errorMessage ? <ValidationMessage>{errorMessage}</ValidationMessage> : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
          <HelperText>
            {t('adminAiCallSettingsUpdatedBy')}:{' '}
            {settings.updatedBy ? `${settings.updatedBy.role} (${settings.updatedBy.id})` : t('adminCommunicationSystemActor')} ·{' '}
            {formatDate(settings.updatedAt, language, { dateStyle: 'medium', timeStyle: 'short' })}
          </HelperText>
          <Button onClick={handleSave} loading={mutation.isPending}>
            {t('adminAiCallSettingsSaveAction')}
          </Button>
        </div>
      </div>
    </Card>
  );
}

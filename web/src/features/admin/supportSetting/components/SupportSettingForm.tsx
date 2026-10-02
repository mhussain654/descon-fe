import { useEffect, useState } from 'react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import { Button, Card, ErrorState, ForbiddenState, HelperText, Input, LoadingState, OfflineState, ValidationMessage } from '../../../../design-system';
import { formatDate } from '../../../../../../shared/i18n/locale';
import { useSupportSetting } from '../hooks/useSupportSetting';
import { useUpdateSupportSetting } from '../hooks/useUpdateSupportSetting';
import { Phone, Save } from 'lucide-react';

/** The support-number singleton settings form (mirrors TrainingSettingForm). Always directly editable -- mirrors AiCallOperationalSettingsForm.tsx's identical "no separate view mode" rationale. */
export function SupportSettingForm() {
  const { t, language } = useLanguage();
  const { signOut } = useStaffAuth();
  const query = useSupportSetting();
  const mutation = useUpdateSupportSetting();
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);

  useEffect(() => {
    if (query.data && phoneNumber === null) setPhoneNumber(query.data.phoneNumber ?? '');
  }, [query.data, phoneNumber]);

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

  if (phoneNumber === null || !query.data) return null;

  const settings = query.data;
  const handleSave = () => {
    mutation.mutate({ phoneNumber });
  };
  const errorMessage = mutation.isError && mutation.error.code === 'VALIDATION_FAILED' ? mutation.error.message : undefined;

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center gap-3 border-b border-border-subtle bg-surface-sunken px-5 py-4"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-subtle text-brand"><Phone className="h-4 w-4" /></span><div><h2 className="font-semibold text-text-primary">{t('adminSupportSettingCardTitle')}</h2><p className="text-xs text-text-secondary">{t('adminSupportSettingCardDescription')}</p></div></div>
      <div className="space-y-4 p-5">
        <Input
          type="tel"
          inputMode="tel"
          dir="ltr"
          autoComplete="tel"
          label={t('adminSupportSettingPhoneLabel')}
          helperText={t('adminSupportSettingPhoneHelper')}
          placeholder="+92 300 1234567"
          value={phoneNumber}
          onChange={(event) => setPhoneNumber(event.target.value)}
        />

        {errorMessage ? <ValidationMessage>{errorMessage}</ValidationMessage> : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
          <HelperText>
            {t('adminAiCallSettingsUpdatedBy')}:{' '}
            {settings.updatedBy ? `${settings.updatedBy.role} (${settings.updatedBy.id})` : t('adminCommunicationSystemActor')} ·{' '}
            {formatDate(settings.updatedAt, language, { dateStyle: 'medium', timeStyle: 'short' })}
          </HelperText>
          <Button onClick={handleSave} loading={mutation.isPending}>
            <Save className="me-1.5 h-4 w-4" />
            {t('adminSupportSettingSaveAction')}
          </Button>
        </div>
      </div>
    </Card>
  );
}

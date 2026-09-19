import { useEffect, useState } from 'react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import { Button, Card, ErrorState, ForbiddenState, HelperText, Input, LoadingState, OfflineState, ValidationMessage } from '../../../../design-system';
import { formatDate } from '../../../../../../shared/i18n/locale';
import { useTrainingSetting } from '../hooks/useTrainingSetting';
import { useUpdateTrainingSetting } from '../hooks/useUpdateTrainingSetting';

/** The training-link singleton settings form. Always directly editable -- mirrors AiCallOperationalSettingsForm.tsx's identical "no separate view mode" rationale. */
export function TrainingSettingForm() {
  const { t, language } = useLanguage();
  const { signOut } = useStaffAuth();
  const query = useTrainingSetting();
  const mutation = useUpdateTrainingSetting();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (query.data && url === null) setUrl(query.data.url);
  }, [query.data, url]);

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

  if (url === null || !query.data) return null;

  const settings = query.data;
  const handleSave = () => {
    mutation.mutate({ url });
  };
  const errorMessage = mutation.isError && mutation.error.code === 'VALIDATION_FAILED' ? mutation.error.message : undefined;

  return (
    <Card>
      <div className="space-y-4">
        <Input
          type="url"
          label={t('adminTrainingSettingUrlLabel')}
          helperText={t('adminTrainingSettingUrlHelper')}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />

        {errorMessage ? <ValidationMessage>{errorMessage}</ValidationMessage> : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
          <HelperText>
            {t('adminAiCallSettingsUpdatedBy')}:{' '}
            {settings.updatedBy ? `${settings.updatedBy.role} (${settings.updatedBy.id})` : t('adminCommunicationSystemActor')} ·{' '}
            {formatDate(settings.updatedAt, language, { dateStyle: 'medium', timeStyle: 'short' })}
          </HelperText>
          <Button onClick={handleSave} loading={mutation.isPending}>
            {t('adminTrainingSettingSaveAction')}
          </Button>
        </div>
      </div>
    </Card>
  );
}

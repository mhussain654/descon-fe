import { useEffect, useState } from 'react';
import { MessageSquare, Pencil } from 'lucide-react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import { Badge, Button, Card, EmptyState, ErrorState, ForbiddenState, Input, LoadingState, OfflineState, Select } from '../../../../design-system';
import { formatDate } from '../../../../../../shared/i18n/locale';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import type { SmsTemplate } from '../../../../lib/admin-app-settings-client';
import { useSmsTemplates } from '../hooks/useSmsTemplates';
import { useUpdateSmsTemplate } from '../hooks/useUpdateSmsTemplate';

/** Settings' SMS settings tab: each send.pk message's English and Urdu template ids and on/off switch, editable in place. */
export function SmsTemplateList() {
  const { t } = useLanguage();
  const { signOut } = useStaffAuth();
  const query = useSmsTemplates();

  useEffect(() => {
    if (query.error?.code === 'SESSION_EXPIRED') signOut('expired');
    else if (query.error?.code === 'INACTIVE_ACCOUNT') signOut('manual');
  }, [query.error, signOut]);

  if (query.isLoading) return <LoadingState message={t('loading')} />;

  if (query.isError) {
    const error = query.error;
    if (error?.code === 'OFFLINE') {
      return <OfflineState title={t('dsOfflineTitle')} description={t('dsOfflineDescription')} retryLabel={t('retry')} onRetry={() => query.refetch()} />;
    }
    if (error?.code === 'FORBIDDEN') return <ForbiddenState title={t('dsForbiddenTitle')} description={t('dsForbiddenDescription')} />;
    if (error?.code === 'SESSION_EXPIRED' || error?.code === 'INACTIVE_ACCOUNT') return null;
    return <ErrorState message={error?.message || t('somethingWentWrong')} retryLabel={t('retry')} onRetry={() => query.refetch()} />;
  }

  const templates = query.data ?? [];
  if (templates.length === 0) {
    return <EmptyState title={t('adminSmsTemplatesEmptyTitle')} description={t('adminSmsTemplatesEmptyDescription')} />;
  }

  return (
    <>
      <p className="mb-4 text-sm text-text-secondary">{t('adminSmsTemplatesIntro')}</p>
      <div className="grid gap-4 xl:grid-cols-2">
        {templates.map((template) => <SmsTemplateRow key={template.messageCode} template={template} />)}
      </div>
    </>
  );
}

function SmsTemplateRow({ template }: { template: SmsTemplate }) {
  const [isEditing, setIsEditing] = useState(false);

  if (!isEditing) return <ViewMode template={template} onEdit={() => setIsEditing(true)} />;
  return <EditMode template={template} onDone={() => setIsEditing(false)} />;
}

function ViewMode({ template, onEdit }: { template: SmsTemplate; onEdit: () => void }) {
  const { t, language } = useLanguage();
  const status = !template.templateIdEn
    ? { tone: 'warning' as const, label: t('adminSmsTemplatesStatusNoTemplate') }
    : template.enabled
      ? { tone: 'success' as const, label: t('adminAppSettingsOn') }
      : { tone: 'neutral' as const, label: t('adminAppSettingsOff') };

  return (
    <Card className="h-full border-t-4 border-t-brand p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-subtle text-brand"><MessageSquare className="h-4 w-4" aria-hidden="true" /></span>
          <h3 className="text-sm font-semibold text-text-primary">{t(messageLabelKey(template.messageCode))}</h3>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={onEdit} aria-label={`${t('adminSmsTemplatesEditAction')}: ${t(messageLabelKey(template.messageCode))}`}>
          <Pencil className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {t('adminSmsTemplatesEditAction')}
        </Button>
      </div>
      <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border-subtle bg-surface-sunken p-3">
        <TemplateId label={t('adminSmsTemplatesEnglishId')} value={template.templateIdEn} />
        <TemplateId label={t('adminSmsTemplatesUrduId')} value={template.templateIdUr} />
      </dl>
      <Variables variables={template.variables} />
      <p className="mt-3 text-xs text-text-tertiary">
        {t('adminAiCallSettingsUpdatedBy')}:{' '}
        {template.updatedBy ? `${template.updatedBy.role} (${template.updatedBy.id})` : t('adminCommunicationSystemActor')} ·{' '}
        {formatDate(template.updatedAt, language, { dateStyle: 'medium', timeStyle: 'short' })}
      </p>
    </Card>
  );
}

function EditMode({ template, onDone }: { template: SmsTemplate; onDone: () => void }) {
  const { t } = useLanguage();
  const [templateIdEn, setTemplateIdEn] = useState(template.templateIdEn ?? '');
  const [templateIdUr, setTemplateIdUr] = useState(template.templateIdUr ?? '');
  const [enabled, setEnabled] = useState(template.enabled);
  const mutation = useUpdateSmsTemplate();
  const label = t(messageLabelKey(template.messageCode));

  const save = () => {
    mutation.mutate(
      { messageCode: template.messageCode, input: { templateIdEn, templateIdUr, ...(template.canDisable ? { enabled } : {}) } },
      { onSuccess: onDone }
    );
  };

  const errorMessage = mutation.isError ? mutation.error.message || t('somethingWentWrong') : undefined;

  return (
    <Card className="h-full border-t-4 border-t-warning p-5 shadow-md">
      <h3 className="mb-3 text-sm font-semibold text-text-primary">{label}</h3>
      <div className="space-y-3">
        <Input
          label={t('adminSmsTemplatesEnglishId')}
          helperText={t('adminSmsTemplatesEnglishHint')}
          value={templateIdEn}
          onChange={(event) => setTemplateIdEn(event.target.value)}
          errorMessage={errorMessage}
          dir="ltr"
          inputMode="numeric"
          maxLength={20}
          autoComplete="off"
        />
        <Input
          label={t('adminSmsTemplatesUrduId')}
          helperText={t('adminSmsTemplatesUrduHint')}
          value={templateIdUr}
          onChange={(event) => setTemplateIdUr(event.target.value)}
          dir="ltr"
          inputMode="numeric"
          maxLength={20}
          autoComplete="off"
        />
        {template.canDisable ? (
          <Select
            label={t('adminSmsTemplatesSendLabel')}
            value={enabled ? 'on' : 'off'}
            onChange={(event) => setEnabled(event.target.value === 'on')}
            options={[
              { value: 'on', label: t('adminAppSettingsOn') },
              { value: 'off', label: t('adminAppSettingsOff') },
            ]}
          />
        ) : (
          <p className="rounded-lg bg-warning-subtle px-3 py-2 text-xs text-warning-emphasis">{t('adminSmsTemplatesOtpAlwaysOn')}</p>
        )}
        <Variables variables={template.variables} />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onDone} disabled={mutation.isPending}>
          {t('adminSmsTemplatesCancelAction')}
        </Button>
        <Button size="sm" onClick={save} loading={mutation.isPending}>
          {t('adminSmsTemplatesSaveAction')}
        </Button>
      </div>
    </Card>
  );
}

function TemplateId({ label, value }: { label: string; value: string | null }) {
  const { t } = useLanguage();

  return (
    <div className="min-w-0">
      <dt className="mb-1 text-xs font-medium text-text-tertiary">{label}</dt>
      <dd>
        {value ? (
          <span dir="ltr" className="font-mono text-sm text-text-primary">{value}</span>
        ) : (
          <span className="text-sm italic text-text-tertiary">{t('adminSmsTemplatesNotSet')}</span>
        )}
      </dd>
    </div>
  );
}

/** The values the message sends, written the way send.pk templates use them (#name#). */
function Variables({ variables }: { variables: string[] }) {
  const { t } = useLanguage();

  return (
    <div className="mt-3">
      <p className="mb-1.5 text-xs font-medium text-text-tertiary">{t('adminSmsTemplatesVariables')}</p>
      <div dir="ltr" className="flex flex-wrap gap-1.5">
        {variables.map((variable) => (
          <code key={variable} className="rounded-md bg-surface-sunken px-1.5 py-0.5 text-xs text-text-secondary">#{variable}#</code>
        ))}
      </div>
    </div>
  );
}

function messageLabelKey(code: string): TranslationKey {
  const camel = code.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
  return `adminAppSettingsSms${camel.charAt(0).toUpperCase()}${camel.slice(1)}` as TranslationKey;
}

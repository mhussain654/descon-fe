import { useEffect, useState } from 'react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import { Badge, Button, Card, ErrorState, ForbiddenState, HelperText, LoadingState, OfflineState, ValidationMessage } from '../../../../design-system';
import { formatDate } from '../../../../../../shared/i18n/locale';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import type { AdminAppSettings, AppFeatureSwitch } from '../../../../lib/admin-app-settings-client';
import { useAppSettings } from '../hooks/useAppSettings';
import { useUpdateAppSettings } from '../hooks/useUpdateAppSettings';
import { CreditCard, FileSearch, MessageSquare, PhoneCall, Save } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Draft {
  enabled: Record<AppFeatureSwitch, boolean>;
}

const SECTIONS: { titleKey: TranslationKey; icon: LucideIcon; switches: AppFeatureSwitch[] }[] = [
  { titleKey: 'adminAppSettingsPaymentsSection', icon: CreditCard, switches: ['cardPayment', 'voucherPayment'] },
  { titleKey: 'adminAppSettingsSmsSection', icon: MessageSquare, switches: ['progressSms'] },
  { titleKey: 'adminAppSettingsCallsSection', icon: PhoneCall, switches: ['automaticCalls', 'bulkCalls'] },
  { titleKey: 'adminAppSettingsDocumentsSection', icon: FileSearch, switches: ['documentOcr'] },
];

function draftFrom(settings: AdminAppSettings): Draft {
  return { enabled: { ...settings.enabled } };
}

function switchKey(name: AppFeatureSwitch, part: 'Label' | 'Description'): TranslationKey {
  return `adminAppSettings${name.charAt(0).toUpperCase()}${name.slice(1)}${part}` as TranslationKey;
}

interface ToggleRowProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  notice?: string;
  onChange: (checked: boolean) => void;
}

/** One labelled on/off switch; `notice` explains why an "on" switch may still do nothing. */
function ToggleRow({ id, label, description, checked, notice, onChange }: ToggleRowProps) {
  const { t } = useLanguage();

  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p id={`${id}-label`} className="text-sm font-medium text-text-primary">{label}</p>
        {description ? <p id={`${id}-description`} className="mt-0.5 text-xs text-text-secondary">{description}</p> : null}
        {notice ? <div className="mt-1.5"><Badge tone="warning">{notice}</Badge></div> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-description` : undefined}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${checked ? 'bg-brand' : 'bg-border'}`}
      >
        <span className="sr-only">{checked ? t('adminAppSettingsOn') : t('adminAppSettingsOff')}</span>
        <span
          aria-hidden="true"
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0.5 rtl:-translate-x-0.5'}`}
        />
      </button>
    </div>
  );
}

/** The App Settings feature switches: payments, progress SMS, calls and document auto-read. Single SMS messages are on the SMS settings tab. */
export function AppFeatureSettingsForm() {
  const { t, language } = useLanguage();
  const { signOut } = useStaffAuth();
  const query = useAppSettings();
  const mutation = useUpdateAppSettings();
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    if (query.data && draft === null) setDraft(draftFrom(query.data));
  }, [query.data, draft]);

  useEffect(() => {
    const code = query.error?.code ?? mutation.error?.code;
    if (code === 'SESSION_EXPIRED') signOut('expired');
    else if (code === 'INACTIVE_ACCOUNT') signOut('manual');
  }, [query.error, mutation.error, signOut]);

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

  if (draft === null || !query.data) return null;

  const settings = query.data;
  const setSwitch = (name: AppFeatureSwitch, value: boolean) =>
    setDraft({ ...draft, enabled: { ...draft.enabled, [name]: value } });
  const errorMessage = mutation.isError ? mutation.error.message || t('somethingWentWrong') : undefined;

  return (
    <Card className="overflow-hidden p-0">
      <div className="divide-y divide-border-subtle">
        {SECTIONS.map(({ titleKey, icon: Icon, switches }) => (
          <section key={titleKey} aria-labelledby={`app-settings-${titleKey}`} className="px-5 py-4">
            <h2 id={`app-settings-${titleKey}`} className="flex items-center gap-2 font-semibold text-text-primary">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-subtle text-brand"><Icon className="h-4 w-4" aria-hidden="true" /></span>
              {t(titleKey)}
            </h2>
            <div className="mt-1 divide-y divide-border-subtle">
              {switches.map((name) => (
                <ToggleRow
                  key={name}
                  id={`app-setting-${name}`}
                  label={t(switchKey(name, 'Label'))}
                  description={t(switchKey(name, 'Description'))}
                  checked={draft.enabled[name]}
                  notice={settings.serverReady[name] ? undefined : t('adminAppSettingsNotSetUpOnServer')}
                  onChange={(value) => setSwitch(name, value)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="space-y-3 border-t border-border-subtle px-5 py-4">
        {errorMessage ? <ValidationMessage>{errorMessage}</ValidationMessage> : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <HelperText>
            {t('adminAiCallSettingsUpdatedBy')}:{' '}
            {settings.updatedBy ? `${settings.updatedBy.role} (${settings.updatedBy.id})` : t('adminCommunicationSystemActor')} ·{' '}
            {formatDate(settings.updatedAt, language, { dateStyle: 'medium', timeStyle: 'short' })}
          </HelperText>
          <Button onClick={() => mutation.mutate(draft)} loading={mutation.isPending}>
            <Save className="me-1.5 h-4 w-4" />
            {t('adminAppSettingsSaveAction')}
          </Button>
        </div>
      </div>
    </Card>
  );
}

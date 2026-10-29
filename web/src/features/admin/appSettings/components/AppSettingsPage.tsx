import { useRef } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { Settings } from 'lucide-react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import { ForbiddenState } from '../../../../design-system';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import { AiCallOperationalSettingsForm } from '../../aiCallOperationalSettings/components/AiCallOperationalSettingsForm';
import { FeeSettingsCard } from '../../payments/components/FeeSettingsCard';
import { SupportSettingForm } from '../../supportSetting/components/SupportSettingForm';
import { AppFeatureSettingsForm } from './AppFeatureSettingsForm';

export type AppSettingsTab = 'features' | 'fee' | 'support' | 'calls';

interface TabDefinition {
  id: AppSettingsTab;
  labelKey: TranslationKey;
  visible: boolean;
  render: () => ReactNode;
}

/**
 * One admin Settings page, a tab per settings area. Each tab shows only for the
 * staff member holding its own permission (the backend enforces the same), and
 * the open tab lives in `?tab=` so a link -- or the old support/call-settings
 * routes -- can open a specific one.
 */
export function AppSettingsPage() {
  const { t, language } = useLanguage();
  const { hasPermission } = useStaffAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const tabs: TabDefinition[] = [
    { id: 'features', labelKey: 'adminAppSettingsTabFeatures', visible: hasPermission('manage_app_settings'), render: () => <AppFeatureSettingsForm /> },
    {
      id: 'fee',
      labelKey: 'adminAppSettingsTabFee',
      visible: hasPermission('view_payments') || hasPermission('manage_payments'),
      render: () => <FeeSettingsCard />,
    },
    { id: 'support', labelKey: 'adminAppSettingsTabSupport', visible: hasPermission('manage_support_settings'), render: () => <SupportSettingForm /> },
    { id: 'calls', labelKey: 'adminAppSettingsTabCalls', visible: hasPermission('manage_ai_call_settings'), render: () => <AiCallOperationalSettingsForm /> },
  ].filter((tab) => tab.visible) as TabDefinition[];

  const requested = searchParams.get('tab');
  const active = tabs.find((tab) => tab.id === requested) ?? tabs[0];
  const selectTab = (id: AppSettingsTab) => setSearchParams({ tab: id }, { replace: true });

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-5 sm:px-6 sm:py-6">
      <div className="relative mb-5 overflow-hidden rounded-2xl bg-brand shadow-md">
        <div aria-hidden="true" className="absolute -right-14 -top-20 h-52 w-52 rounded-full border-[28px] border-white/10" />
        <div className="relative flex items-center gap-4 px-6 py-7 lg:px-8">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
            <Settings className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="max-w-3xl">
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{t('adminAppSettingsTitle')}</h1>
            <p className="mt-1 text-sm leading-6 text-white/80">{t('adminAppSettingsSubtitle')}</p>
          </div>
        </div>
      </div>

      {active ? (
        <>
          <div role="tablist" aria-label={t('adminAppSettingsTabsLabel')} className="mb-5 flex flex-wrap gap-2 rounded-xl border border-border bg-surface p-2">
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                type="button"
                role="tab"
                id={`settings-tab-${tab.id}`}
                aria-controls={`settings-panel-${tab.id}`}
                aria-selected={active.id === tab.id}
                tabIndex={active.id === tab.id ? 0 : -1}
                onClick={() => selectTab(tab.id)}
                onKeyDown={(event) => {
                  const step = { ArrowRight: language === 'ur' ? -1 : 1, ArrowLeft: language === 'ur' ? 1 : -1 }[event.key];
                  let target: number | undefined;
                  if (event.key === 'Home') target = 0;
                  if (event.key === 'End') target = tabs.length - 1;
                  if (step !== undefined) target = (index + step + tabs.length) % tabs.length;
                  if (target === undefined) return;
                  event.preventDefault();
                  selectTab(tabs[target].id);
                  tabRefs.current[target]?.focus();
                }}
                className={`rounded-lg px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active.id === tab.id ? 'bg-brand text-white shadow-sm' : 'text-text-secondary hover:bg-surface-sunken'}`}
              >
                {t(tab.labelKey)}
              </button>
            ))}
          </div>
          <section role="tabpanel" id={`settings-panel-${active.id}`} aria-labelledby={`settings-tab-${active.id}`}>
            {active.render()}
          </section>
        </>
      ) : (
        <ForbiddenState title={t('dsForbiddenTitle')} description={t('dsForbiddenDescription')} />
      )}
    </div>
  );
}

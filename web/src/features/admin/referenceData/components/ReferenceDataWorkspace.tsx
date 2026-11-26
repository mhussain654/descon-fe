import { Database } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { FilterChip } from '../../../../design-system';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import { ChecklistSection } from './ChecklistSection';
import { LookupSection } from './LookupSection';
import { RolePermissionsSection } from './RolePermissionsSection';
import { WorkflowStagesSection } from './WorkflowStagesSection';

export const REFERENCE_DATA_TABS = ['countries', 'projects', 'crafts', 'roles', 'checklists', 'stages'] as const;
export type ReferenceDataTab = (typeof REFERENCE_DATA_TABS)[number];

const TAB_LABEL_KEYS: Record<ReferenceDataTab, TranslationKey> = {
  countries: 'adminRefDataTabCountries',
  projects: 'adminRefDataTabProjects',
  crafts: 'adminRefDataTabCrafts',
  roles: 'adminRefDataTabRoles',
  checklists: 'adminRefDataTabChecklists',
  stages: 'adminRefDataTabStages',
};

/**
 * Developer-only Reference data: countries, projects, crafts, role
 * permissions, document checklists and workflow stage names. The tab is kept
 * in the URL (?tab=). The backend (manage_reference_data) is the real
 * boundary; the route and nav link are hidden from everyone else.
 */
export function ReferenceDataWorkspace() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab') as ReferenceDataTab | null;
  const tab: ReferenceDataTab = requested && REFERENCE_DATA_TABS.includes(requested) ? requested : 'countries';

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6">
      <div className="relative mb-5 overflow-hidden rounded-2xl bg-brand shadow-md">
        <div aria-hidden="true" className="absolute -right-14 -top-20 h-52 w-52 rounded-full border-[28px] border-white/10" />
        <div className="relative flex items-center gap-4 px-5 py-6 sm:px-6 lg:px-8">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
            <Database className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/70">{t('adminRefDataEyebrow')}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{t('adminRefDataTitle')}</h1>
            <p className="mt-1 text-sm text-white/80">{t('adminRefDataSubtitle')}</p>
          </div>
        </div>
      </div>

      <nav aria-label={t('adminRefDataSectionsLabel')} className="mb-5 flex flex-wrap gap-2">
        {REFERENCE_DATA_TABS.map((key) => (
          <FilterChip key={key} selected={tab === key} onClick={() => setSearchParams(key === 'countries' ? {} : { tab: key })}>
            {t(TAB_LABEL_KEYS[key])}
          </FilterChip>
        ))}
      </nav>

      {tab === 'countries' || tab === 'projects' || tab === 'crafts' ? <LookupSection key={tab} kind={tab} /> : null}
      {tab === 'roles' ? <RolePermissionsSection /> : null}
      {tab === 'checklists' ? <ChecklistSection /> : null}
      {tab === 'stages' ? <WorkflowStagesSection /> : null}
    </div>
  );
}

import { Card, Select } from '../../../../design-system';
import { useCountries, useCrafts, useProjects } from '../../candidates/hooks/useReferenceData';
import type { DashboardFilters } from '../../../../../../shared/adminReports/types';
import type { TFn } from './ReportTables';

/** Country/project/craft filter row, scoping every dashboard section to matching candidates -- reuses the exact reference-data hooks and Select pattern CandidateListWorkspace.tsx's own filter row already established, not a second implementation. Shared across every admin dashboard (Admin/MPS/...) that accepts the same filter vocabulary, not duplicated per dashboard. */
export function DashboardFilterBar({
  filters,
  onChange,
  t,
}: {
  filters: DashboardFilters;
  onChange: (patch: Partial<DashboardFilters>) => void;
  t: TFn;
}) {
  const countriesQuery = useCountries();
  const projectsQuery = useProjects();
  const craftsQuery = useCrafts();
  const hasActiveFilters = Boolean(filters.countryCode || filters.projectCode || filters.craftCode);

  return (
    <Card className="mb-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Select
          label={t('adminCandidateListFilterCountryLabel')}
          value={filters.countryCode ?? ''}
          onChange={(event) => onChange({ countryCode: event.target.value || undefined })}
          options={[
            { value: '', label: t('adminCandidateListFilterAllCountries') },
            ...(countriesQuery.data ?? []).map((item) => ({ value: item.code, label: item.name })),
          ]}
        />
        <Select
          label={t('adminCandidateListFilterProjectLabel')}
          value={filters.projectCode ?? ''}
          onChange={(event) => onChange({ projectCode: event.target.value || undefined })}
          options={[
            { value: '', label: t('adminCandidateListFilterAllProjects') },
            ...(projectsQuery.data ?? []).map((item) => ({ value: item.code, label: item.name })),
          ]}
        />
        <Select
          label={t('adminCandidateListFilterCraftLabel')}
          value={filters.craftCode ?? ''}
          onChange={(event) => onChange({ craftCode: event.target.value || undefined })}
          options={[
            { value: '', label: t('adminCandidateListFilterAllCrafts') },
            ...(craftsQuery.data ?? []).map((item) => ({ value: item.code, label: item.name })),
          ]}
        />
      </div>
      {hasActiveFilters ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => onChange({ countryCode: undefined, projectCode: undefined, craftCode: undefined })}
            className="text-sm font-medium text-brand hover:underline"
          >
            {t('adminCandidateListClearFilters')}
          </button>
        </div>
      ) : null}
    </Card>
  );
}

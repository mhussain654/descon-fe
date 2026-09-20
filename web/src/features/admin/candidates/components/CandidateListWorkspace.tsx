import { useCallback, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router';
import { SlidersHorizontal, Users } from 'lucide-react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import {
  Badge,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  ForbiddenState,
  Input,
  LoadingState,
  OfflineState,
  Pagination,
  RetryBanner,
  Select,
  type DataTableColumn,
} from '../../../../design-system';
import { ADMIN_CANDIDATE_ERROR_KEYS } from '../../../../../../shared/adminCandidates/errorMessages';
import type { AdminCandidateDetail, AdminCandidateListFilters, AdminCandidateListSort } from '../../../../lib/admin-candidates-client';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import { CANONICAL_WORKFLOW_STAGE_CODES, WORKFLOW_STAGE_LABEL_KEYS } from '../../../../../../shared/adminWorkflow/canonicalStages';
import { useDebouncedUrlFilter } from '../../documentReviews/hooks/useDebouncedUrlFilter';
import { useCandidateList } from '../hooks/useCandidateList';
import { useCountries, useCrafts, useProjects } from '../hooks/useReferenceData';
import { readCandidateListStateFromSearchParams, writeCandidateListStateToSearchParams } from '../candidateListUrlState';

const SORT_OPTIONS: { value: AdminCandidateListSort; labelKey: TranslationKey }[] = [
  { value: '-created_at', labelKey: 'adminCandidateListSortNewest' },
  { value: 'created_at', labelKey: 'adminCandidateListSortOldest' },
  { value: 'full_name', labelKey: 'adminCandidateListSortNameAsc' },
  { value: '-full_name', labelKey: 'adminCandidateListSortNameDesc' },
  { value: 'reference_number', labelKey: 'adminCandidateListSortReferenceAsc' },
  { value: '-reference_number', labelKey: 'adminCandidateListSortReferenceDesc' },
];

/** The full admin candidate list workspace: search, filters, sort and pagination, all backed by the URL -- mirrors DocumentReviewQueue.tsx's identical structure. */
export function CandidateListWorkspace() {
  const { t } = useLanguage();
  const { hasPermission, signOut } = useStaffAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters, sort, page } = readCandidateListStateFromSearchParams(searchParams);

  const query = useCandidateList(filters, sort, page);
  const countriesQuery = useCountries();
  const projectsQuery = useProjects();
  const craftsQuery = useCrafts();

  // See DocumentReviewQueue.tsx's identical comment -- a confirmed-dead
  // session or a deactivated account must end the local session so
  // RequireStaffAuth's redirect-to-login takes over.
  useEffect(() => {
    if (query.error?.code === 'SESSION_EXPIRED') {
      signOut('expired');
    } else if (query.error?.code === 'INACTIVE_ACCOUNT') {
      signOut('manual');
    }
  }, [query.error, signOut]);

  const updateFilters = useCallback(
    (patch: Partial<AdminCandidateListFilters>, nextSort: AdminCandidateListSort | undefined = sort) => {
      const nextFilters = { ...filters, ...patch };
      setSearchParams(writeCandidateListStateToSearchParams(nextFilters, nextSort, { ...page, number: 1 }));
    },
    [filters, sort, page, setSearchParams]
  );

  const [searchDraft, setSearchDraft] = useDebouncedUrlFilter(filters.search ?? '', (value) => updateFilters({ search: value || undefined }));

  const clearFilters = () => {
    setSearchDraft('');
    setSearchParams(new URLSearchParams());
  };

  const hasActiveFilters = Boolean(filters.search || filters.status || filters.countryCode || filters.projectCode || filters.craftCode || sort);

  const columns: DataTableColumn<AdminCandidateDetail>[] = [
    {
      key: 'candidate',
      header: t('adminCandidateListColumnCandidate'),
      render: (row) => (
        <div className="flex min-w-[190px] items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-subtle text-sm font-semibold text-brand">
            {row.fullName.trim().charAt(0).toUpperCase() || 'C'}
          </div>
          <div className="min-w-0">
            <Link to={`/admin/candidates/${row.id}`} className="block truncate font-semibold text-brand hover:underline">
              {row.fullName}
            </Link>
            <div className="mt-0.5 text-xs text-text-tertiary">{row.cnic}</div>
          </div>
        </div>
      ),
    },
    { key: 'mobile', header: t('adminCandidateListColumnMobile'), render: (row) => row.mobileNumber },
    {
      key: 'reference',
      header: t('adminCandidateListColumnReference'),
      render: (row) => row.assignment?.referenceNumber ?? t('notAvailable'),
    },
    {
      key: 'assignment',
      header: t('adminDocumentReviewColumnAssignment'),
      render: (row) =>
        row.assignment ? (
          <div className="min-w-[170px]">
            <div className="font-medium text-text-primary">{row.assignment.project.name}</div>
            <div className="mt-0.5 text-xs text-text-tertiary">
              {row.assignment.country.name} · {row.assignment.craft.name}
            </div>
          </div>
        ) : (
          t('notAvailable')
        ),
    },
    {
      key: 'stage',
      header: t('adminCandidateListColumnStage'),
      render: (row) => (row.assignment ? <Badge tone="info">{row.assignment.currentWorkflowStage.name}</Badge> : t('notAvailable')),
    },
  ];

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6">
      <div className="relative mb-5 overflow-hidden rounded-2xl bg-brand shadow-md">
        <div aria-hidden="true" className="absolute -right-14 -top-20 h-52 w-52 rounded-full border-[28px] border-white/10" />
        <div aria-hidden="true" className="absolute -bottom-16 right-40 h-36 w-36 rounded-full bg-white/5" />
        <div className="relative flex flex-col gap-5 px-6 py-7 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div className="max-w-2xl">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/70">{t('adminCandidateListEyebrow')}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{t('adminCandidateListTitle')}</h1>
            <p className="mt-1 text-sm leading-6 text-white/80">{t('adminCandidateListSubtitle')}</p>
          </div>
          {hasPermission('manage_candidates') ? (
            <Link
              to="/admin/candidates/new"
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-brand shadow-sm transition hover:-translate-y-0.5 hover:bg-white/95 hover:shadow-md"
            >
              {t('adminAddCandidate')}
            </Link>
          ) : null}
        </div>
      </div>

      <Card className="mb-5 p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-subtle text-brand">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-semibold text-text-primary">{t('adminCandidateListFilterTitle')}</h2>
            <p className="text-xs text-text-secondary">{t('adminCandidateListFilterSubtitle')}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
          <Input
            label={t('adminCandidateListSearchLabel')}
            placeholder={t('adminCandidateListSearchPlaceholder')}
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
          />
          </div>
          <Select
            label={t('adminCandidateListFilterStatusLabel')}
            value={filters.status ?? ''}
            onChange={(event) => updateFilters({ status: event.target.value || undefined })}
            options={[
              { value: '', label: t('adminCandidateListFilterAllStatuses') },
              ...CANONICAL_WORKFLOW_STAGE_CODES.map((code) => ({ value: code, label: t(WORKFLOW_STAGE_LABEL_KEYS[code]) })),
            ]}
          />
          <Select
            label={t('adminCandidateListSortLabel')}
            value={sort ?? ''}
            onChange={(event) => updateFilters({}, (event.target.value || undefined) as AdminCandidateListSort | undefined)}
            options={[{ value: '', label: t('adminCandidateListSortNewest') }, ...SORT_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))]}
          />
          <Select
            label={t('adminCandidateListFilterCountryLabel')}
            value={filters.countryCode ?? ''}
            onChange={(event) => updateFilters({ countryCode: event.target.value || undefined })}
            options={[
              { value: '', label: t('adminCandidateListFilterAllCountries') },
              ...(countriesQuery.data ?? []).map((item) => ({ value: item.code, label: item.name })),
            ]}
          />
          <Select
            label={t('adminCandidateListFilterProjectLabel')}
            value={filters.projectCode ?? ''}
            onChange={(event) => updateFilters({ projectCode: event.target.value || undefined })}
            options={[
              { value: '', label: t('adminCandidateListFilterAllProjects') },
              ...(projectsQuery.data ?? []).map((item) => ({ value: item.code, label: item.name })),
            ]}
          />
          <Select
            label={t('adminCandidateListFilterCraftLabel')}
            value={filters.craftCode ?? ''}
            onChange={(event) => updateFilters({ craftCode: event.target.value || undefined })}
            options={[
              { value: '', label: t('adminCandidateListFilterAllCrafts') },
              ...(craftsQuery.data ?? []).map((item) => ({ value: item.code, label: item.name })),
            ]}
          />
        </div>
        {hasActiveFilters ? (
          <div className="mt-4">
            <button type="button" onClick={clearFilters} className="text-sm font-medium text-brand hover:underline">
              {t('adminCandidateListClearFilters')}
            </button>
          </div>
        ) : null}
      </Card>

      <ListContent
        query={query}
        columns={columns}
        page={page}
        onPageChange={(number) => setSearchParams(writeCandidateListStateToSearchParams(filters, sort, { ...page, number }))}
        hasActiveFilters={hasActiveFilters}
        t={t}
      />
    </div>
  );
}

interface ListContentProps {
  query: ReturnType<typeof useCandidateList>;
  columns: DataTableColumn<AdminCandidateDetail>[];
  page: { number?: number; size?: number };
  onPageChange: (page: number) => void;
  hasActiveFilters: boolean;
  t: (key: TranslationKey) => string;
}

function ListContent({ query, columns, page, onPageChange, hasActiveFilters, t }: ListContentProps) {
  if (query.isLoading) {
    return <LoadingState message={t('loading')} />;
  }

  if (query.isError && !query.data) {
    const error = query.error;
    if (error?.code === 'OFFLINE') {
      return (
        <OfflineState title={t('dsOfflineTitle')} description={t('dsOfflineDescription')} retryLabel={t('retry')} onRetry={() => query.refetch()} />
      );
    }
    if (error?.code === 'FORBIDDEN') {
      return <ForbiddenState title={t('dsForbiddenTitle')} description={t('staffAuthForbiddenError')} />;
    }
    if (error?.code === 'SESSION_EXPIRED' || error?.code === 'INACTIVE_ACCOUNT') {
      // signOut() (triggered above) hands off to RequireStaffAuth's own redirect -- nothing further to render here.
      return null;
    }
    const messageKey = (error ? ADMIN_CANDIDATE_ERROR_KEYS[error.code] : 'somethingWentWrong') as TranslationKey;
    return <ErrorState message={error?.message || t(messageKey)} retryLabel={t('retry')} onRetry={() => query.refetch()} />;
  }

  const result = query.data;
  const items = result?.items ?? [];
  const pagination = result?.pagination;

  if (items.length === 0) {
    return hasActiveFilters ? (
      <EmptyState title={t('adminCandidateListEmptyFilteredTitle')} description={t('adminCandidateListEmptyFilteredDescription')} />
    ) : (
      <EmptyState title={t('adminCandidateListEmptyTitle')} description={t('adminCandidateListEmptyDescription')} />
    );
  }

  return (
    <div>
      {query.isError ? (
        <div className="mb-4">
          <RetryBanner message={t('adminCandidateListLoadError')} retryLabel={t('retry')} onRetry={() => query.refetch()} />
        </div>
      ) : null}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Users className="h-4 w-4 text-brand" aria-hidden="true" />
          <span>
            <strong className="font-semibold text-text-primary">{pagination?.totalCount ?? items.length}</strong>{' '}
            {t('adminCandidateListResultsLabel')}
          </span>
        </div>
        <span className="text-xs text-text-tertiary">{t('adminCandidateListResultsHint')}</span>
      </div>
      <Card noPadding className="min-w-0 overflow-hidden [&_tbody_tr:nth-child(even)]:bg-surface-sunken/45 [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-brand-subtle/40">
        <DataTable columns={columns} rows={items} getRowId={(row) => row.id} />
      </Card>
      {pagination ? (
        <div className="mt-4">
          <Pagination
            page={pagination.page || page.number || 1}
            pageCount={pagination.totalPages}
            onPageChange={onPageChange}
            previousLabel={t('dsPreviousPage')}
            nextLabel={t('dsNextPage')}
          />
        </div>
      ) : null}
    </div>
  );
}

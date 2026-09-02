import { useCallback, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router';
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
import { formatDate } from '../../../../../../shared/i18n/locale';
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
  const { t, language } = useLanguage();
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
        <Link to={`/admin/candidates/${row.id}`} className="font-medium text-brand hover:underline">
          <div>{row.fullName}</div>
          <div className="text-xs font-normal text-text-tertiary">{row.id}</div>
        </Link>
      ),
    },
    { key: 'cnic', header: t('adminCandidateListColumnCnic'), render: (row) => row.cnic },
    { key: 'mobile', header: t('adminCandidateListColumnMobile'), render: (row) => row.mobileNumber },
    {
      key: 'reference',
      header: t('adminCandidateListColumnReference'),
      render: (row) => row.assignment?.referenceNumber ?? t('notAvailable'),
    },
    { key: 'country', header: t('adminCandidateListColumnCountry'), render: (row) => row.assignment?.country.name ?? t('notAvailable') },
    { key: 'project', header: t('adminCandidateListColumnProject'), render: (row) => row.assignment?.project.name ?? t('notAvailable') },
    { key: 'craft', header: t('adminCandidateListColumnCraft'), render: (row) => row.assignment?.craft.name ?? t('notAvailable') },
    {
      key: 'stage',
      header: t('adminCandidateListColumnStage'),
      render: (row) => (row.assignment ? <Badge tone="info">{row.assignment.currentWorkflowStage.name}</Badge> : t('notAvailable')),
    },
    {
      key: 'created',
      header: t('adminCandidateListColumnCreated'),
      render: (row) => formatDate(row.createdAt, language, { dateStyle: 'medium' }),
    },
  ];

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-text-primary">{t('adminCandidateListTitle')}</h1>
        {hasPermission('manage_candidates') ? (
          <Link
            to="/admin/candidates/new"
            className="inline-flex h-10 items-center rounded-xl bg-brand px-4 text-sm font-medium text-white hover:bg-brand/90"
          >
            {t('adminAddCandidate')}
          </Link>
        ) : null}
      </div>

      <Card className="mb-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            label={t('adminCandidateListSearchLabel')}
            placeholder={t('adminCandidateListSearchPlaceholder')}
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
          />
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
      <Card noPadding>
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

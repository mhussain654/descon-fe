import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Clock, FileCheck2, SlidersHorizontal } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import {
  Badge,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  FilterChip,
  ForbiddenState,
  Input,
  LoadingState,
  OfflineState,
  Pagination,
  RetryBanner,
  type DataTableColumn,
} from '../../../../design-system';
import { formatDate } from '../../../../../../shared/i18n/locale';
import { ADMIN_DOCUMENT_REVIEW_ERROR_KEYS } from '../../../../../../shared/adminDocumentReviews/errorMessages';
import { referenceDisplayName } from '../../../../../../shared/adminDocumentReviews/formatting';
import {
  CategoryDonutChart,
  DOCUMENT_REVIEW_ROW_STYLE,
} from '../../reports/components/ReportCharts';
import {
  DOCUMENT_REVIEW_SUMMARY_ROWS,
  FILTERABLE_QUEUE_STATUSES,
  QUEUE_STATUS_FILTER_ONLY_KEYS,
  QUEUE_STATUS_FILTER_ONLY_TONES,
  REVIEW_STATE_KEYS,
  REVIEW_STATE_TONES,
} from '../../../../../../shared/adminDocumentReviews/statusLabels';
import type { DocumentReviewQueueItem, QueueStatusFilter } from '../../../../../../shared/adminDocumentReviews/types';

/** Merges the 4 review-state labels/tones with the 3 filter-only ones (rejected/expired_pcc/near_expiry_pcc) so every chip in FILTERABLE_QUEUE_STATUSES has a label and tone. */
const QUEUE_STATUS_KEYS = { ...REVIEW_STATE_KEYS, ...QUEUE_STATUS_FILTER_ONLY_KEYS } as Record<QueueStatusFilter, string>;
const QUEUE_STATUS_TONES = { ...REVIEW_STATE_TONES, ...QUEUE_STATUS_FILTER_ONLY_TONES } as Record<
  QueueStatusFilter,
  (typeof REVIEW_STATE_TONES)[keyof typeof REVIEW_STATE_TONES]
>;

const SUMMARY_ROWS = DOCUMENT_REVIEW_SUMMARY_ROWS;
const SUMMARY_CARD_STYLE = {
  brand: 'border-t-brand bg-brand-subtle/55 text-brand',
  success: 'border-t-success bg-success-subtle/65 text-success-emphasis',
  warning: 'border-t-warning bg-warning-subtle/70 text-warning-emphasis',
  danger: 'border-t-danger bg-danger-subtle/65 text-danger-emphasis',
  info: 'border-t-info bg-info-subtle/65 text-info-emphasis',
  neutral: 'border-t-text-tertiary bg-surface-sunken text-text-secondary',
} as const;
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import { datetimeLocalValueToIso, isoToDatetimeLocalValue } from '../dateTimeLocalInput';
import { useDebouncedUrlFilter } from '../hooks/useDebouncedUrlFilter';
import { useDocumentReviewQueue } from '../hooks/useDocumentReviewQueue';
import { DEFAULT_PAGE_SIZE, readQueueStateFromSearchParams, writeQueueStateToSearchParams } from '../queueUrlState';

/** The full admin document-review queue screen: filters, table and pagination, all backed by the URL. */
export function DocumentReviewQueue() {
  const { t, language } = useLanguage();
  const { signOut } = useStaffAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const { filters, page } = readQueueStateFromSearchParams(searchParams);

  const query = useDocumentReviewQueue(filters, page);

  // See CandidateImportForm.tsx's identical comment -- a confirmed-dead
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
    (patch: Partial<typeof filters>, resetPage = true) => {
      const nextFilters = { ...filters, ...patch };
      const nextPage = resetPage ? { ...page, number: 1 } : page;
      setSearchParams(writeQueueStateToSearchParams(nextFilters, nextPage));
    },
    [filters, page, setSearchParams]
  );

  const [candidateIdDraft, setCandidateIdDraft] = useDebouncedUrlFilter(
    filters.candidatePublicId ?? '',
    (value) => updateFilters({ candidatePublicId: value || undefined })
  );
  const [projectDraft, setProjectDraft] = useDebouncedUrlFilter(filters.projectCode ?? '', (value) =>
    updateFilters({ projectCode: value || undefined })
  );
  const [countryDraft, setCountryDraft] = useDebouncedUrlFilter(filters.countryCode ?? '', (value) =>
    updateFilters({ countryCode: value || undefined })
  );

  const toggleStatus = (status: QueueStatusFilter) => {
    const current = filters.status ?? [];
    const next = current.includes(status) ? current.filter((s) => s !== status) : [...current, status];
    updateFilters({ status: next });
  };

  const clearFilters = () => {
    setCandidateIdDraft('');
    setProjectDraft('');
    setCountryDraft('');
    setSearchParams(new URLSearchParams());
  };

  const hasActiveFilters =
    Boolean(filters.candidatePublicId || filters.projectCode || filters.countryCode || filters.submittedFrom || filters.submittedTo) ||
    (filters.status ?? []).length !== 2 ||
    !(filters.status ?? []).includes('pending_review') ||
    !(filters.status ?? []).includes('partially_reviewed');

  const columns: DataTableColumn<DocumentReviewQueueItem>[] = [
    {
      key: 'candidate',
      header: t('adminDocumentReviewColumnCandidate'),
      render: (row) => (
        <div className="flex min-w-[210px] items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-subtle text-sm font-semibold text-brand">
            {row.candidate.fullName.trim().charAt(0).toUpperCase() || 'C'}
          </div>
          <div className="min-w-0">
            <Link to={`/admin/document-reviews/${row.id}`} className="block truncate font-semibold text-brand hover:underline">
              {row.candidate.fullName}
            </Link>
            <div className="mt-0.5 text-xs text-text-tertiary">{row.assignment.referenceNumber}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'assignment',
      header: t('adminDocumentReviewColumnAssignment'),
      render: (row) => (
        <div className="min-w-[180px]">
          <div className="font-medium text-text-primary">
            {referenceDisplayName(row.assignment.project, t('adminDocumentReviewNameUnavailable'))}
          </div>
          <div className="mt-0.5 text-xs text-text-tertiary">
            {referenceDisplayName(row.assignment.country, t('adminDocumentReviewNameUnavailable'))} ·{' '}
            {referenceDisplayName(row.assignment.craft, t('adminDocumentReviewNameUnavailable'))}
          </div>
        </div>
      ),
    },
    {
      key: 'submitted',
      header: t('adminDocumentReviewColumnSubmitted'),
      render: (row) => formatDate(row.submittedAt, language, { dateStyle: 'medium', timeStyle: 'short' }),
    },
    {
      key: 'status',
      header: t('adminDocumentReviewColumnStatus'),
      render: (row) => <Badge tone={REVIEW_STATE_TONES[row.review.reviewState]}>{t(REVIEW_STATE_KEYS[row.review.reviewState])}</Badge>,
    },
    {
      key: 'documents',
      header: t('adminDocumentReviewColumnDocuments'),
      render: (row) => (
        <div className="flex gap-1 text-xs">
          <Badge tone="info">{row.review.pendingReview}</Badge>
          <Badge tone="success">{row.review.verified}</Badge>
          <Badge tone="danger">{row.review.rejected}</Badge>
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6">
      <div className="relative mb-5 overflow-hidden rounded-2xl bg-brand shadow-md">
        <div aria-hidden="true" className="absolute -right-14 -top-20 h-52 w-52 rounded-full border-[28px] border-white/10" />
        <div aria-hidden="true" className="absolute -bottom-16 right-40 h-36 w-36 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-4 px-6 py-7 lg:px-8">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
            <FileCheck2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="max-w-2xl">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/70">{t('adminDocumentReviewEyebrow')}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{t('adminDocumentReviewQueueTitle')}</h1>
            <p className="mt-1 text-sm leading-6 text-white/80">{t('adminDocumentReviewSubtitle')}</p>
          </div>
        </div>
      </div>

      {query.data?.summary ? (
        <Card className="mb-5 p-5">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-semibold text-text-primary">{t('adminDocumentReviewSummaryTitle')}</h2>
              <p className="text-xs text-text-secondary">{t('adminDocumentReviewSummarySubtitle')}</p>
            </div>
          </div>
          <div className="grid items-center gap-5 lg:grid-cols-[170px_minmax(0,1fr)]">
            <div className="relative mx-auto">
              <CategoryDonutChart
                data={SUMMARY_ROWS.map((row) => ({
                  key: row.key,
                  label: t(row.labelKey as TranslationKey),
                  value: query.data?.summary[row.key] ?? 0,
                  tone: DOCUMENT_REVIEW_ROW_STYLE[row.key]?.tone,
                }))}
              />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold tracking-tight text-text-primary">
                  {SUMMARY_ROWS.reduce((total, row) => total + (query.data?.summary[row.key] ?? 0), 0)}
                </span>
                <span className="text-[11px] font-medium text-text-tertiary">{t('adminDocumentReviewTotalLabel')}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              {SUMMARY_ROWS.map((row) => {
                const style = DOCUMENT_REVIEW_ROW_STYLE[row.key];
                const tone = style?.tone ?? 'neutral';
                const Icon = style?.icon ?? Clock;
                return (
                  <div
                    key={row.key}
                    className={`relative overflow-hidden rounded-xl border border-border border-t-4 px-4 py-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${SUMMARY_CARD_STYLE[tone]}`}
                  >
                    <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-surface-raised/75">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="text-3xl font-bold tracking-tight">{query.data?.summary[row.key] ?? 0}</div>
                    <div className="mt-0.5 text-xs font-semibold text-text-secondary">{t(row.labelKey as TranslationKey)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      ) : null}

      <Card className="mb-5 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold text-text-primary">{t('adminDocumentReviewFilterTitle')}</h2>
            <p className="text-xs text-text-secondary">{t('adminDocumentReviewFilterSubtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERABLE_QUEUE_STATUSES.map((status) => (
              <FilterChip key={status} selected={(filters.status ?? []).includes(status)} onClick={() => toggleStatus(status)}>
                {t(QUEUE_STATUS_KEYS[status] as TranslationKey)}
              </FilterChip>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowAdvancedFilters((value) => !value)}
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-brand hover:underline"
          aria-expanded={showAdvancedFilters}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          {t('adminDocumentReviewAdvancedFilters')}
          <ChevronDown className={`h-4 w-4 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        {showAdvancedFilters ? <div className="mt-4 grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            label={t('adminDocumentReviewFilterCandidateIdLabel')}
            value={candidateIdDraft}
            onChange={(event) => setCandidateIdDraft(event.target.value)}
          />
          <Input
            label={t('adminDocumentReviewFilterProjectLabel')}
            value={projectDraft}
            onChange={(event) => setProjectDraft(event.target.value)}
          />
          <Input
            label={t('adminDocumentReviewFilterCountryLabel')}
            value={countryDraft}
            onChange={(event) => setCountryDraft(event.target.value)}
          />
          <Input
            type="datetime-local"
            label={t('adminDocumentReviewFilterSubmittedFromLabel')}
            value={isoToDatetimeLocalValue(filters.submittedFrom)}
            onChange={(event) => updateFilters({ submittedFrom: datetimeLocalValueToIso(event.target.value) })}
          />
          <Input
            type="datetime-local"
            label={t('adminDocumentReviewFilterSubmittedToLabel')}
            value={isoToDatetimeLocalValue(filters.submittedTo)}
            onChange={(event) => updateFilters({ submittedTo: datetimeLocalValueToIso(event.target.value) })}
          />
        </div> : null}
        {hasActiveFilters ? (
          <div className="mt-4">
            <button type="button" onClick={clearFilters} className="text-sm font-medium text-brand hover:underline">
              {t('adminDocumentReviewClearFilters')}
            </button>
          </div>
        ) : null}
      </Card>

      <QueueContent
        query={query}
        columns={columns}
        page={page}
        onPageChange={(number) => setSearchParams(writeQueueStateToSearchParams(filters, { ...page, number }))}
        hasActiveFilters={hasActiveFilters}
        t={t}
      />
    </div>
  );
}

interface QueueContentProps {
  query: ReturnType<typeof useDocumentReviewQueue>;
  columns: DataTableColumn<DocumentReviewQueueItem>[];
  page: { number?: number; size?: number };
  onPageChange: (page: number) => void;
  hasActiveFilters: boolean;
  t: (key: TranslationKey) => string;
}

function QueueContent({ query, columns, page, onPageChange, hasActiveFilters, t }: QueueContentProps) {
  if (query.isLoading) {
    return <LoadingState message={t('loading')} />;
  }

  if (query.isError && !query.data) {
    const error = query.error;
    if (error?.code === 'OFFLINE') {
      return <OfflineState title={t('dsOfflineTitle')} description={t('dsOfflineDescription')} retryLabel={t('retry')} onRetry={() => query.refetch()} />;
    }
    if (error?.code === 'REVIEW_NOT_ALLOWED' || error?.code === 'FORBIDDEN') {
      return <ForbiddenState title={t('dsForbiddenTitle')} description={t('staffAuthForbiddenError')} />;
    }
    if (error?.code === 'SESSION_EXPIRED' || error?.code === 'INACTIVE_ACCOUNT') {
      // signOut() (triggered above) hands off to RequireStaffAuth's own redirect -- nothing further to render here.
      return null;
    }
    const messageKey = (error ? ADMIN_DOCUMENT_REVIEW_ERROR_KEYS[error.code] : 'somethingWentWrong') as TranslationKey;
    return <ErrorState message={error?.message || t(messageKey)} retryLabel={t('retry')} onRetry={() => query.refetch()} />;
  }

  const result = query.data;
  const items = result?.items ?? [];
  const pagination = result?.pagination;

  if (items.length === 0) {
    return hasActiveFilters ? (
      <EmptyState title={t('adminDocumentReviewEmptyFilteredTitle')} description={t('adminDocumentReviewEmptyFilteredDescription')} />
    ) : (
      <EmptyState title={t('adminDocumentReviewEmptyQueueTitle')} description={t('adminDocumentReviewEmptyQueueDescription')} />
    );
  }

  return (
    <div>
      {query.isError ? (
        <div className="mb-4">
          <RetryBanner message={t('adminDocumentReviewQueueLoadError')} retryLabel={t('retry')} onRetry={() => query.refetch()} />
        </div>
      ) : null}
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

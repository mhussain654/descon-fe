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
import { FILTERABLE_REVIEW_STATES, REVIEW_STATE_KEYS, REVIEW_STATE_TONES } from '../../../../../../shared/adminDocumentReviews/statusLabels';
import type { DocumentReviewQueueItem, ReviewState } from '../../../../../../shared/adminDocumentReviews/types';
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

  const toggleStatus = (status: ReviewState) => {
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
        <Link to={`/admin/document-reviews/${row.id}`} className="font-medium text-brand hover:underline">
          <div>{row.candidate.fullName}</div>
          <div className="text-xs font-normal text-text-tertiary">{row.candidate.id}</div>
        </Link>
      ),
    },
    {
      key: 'assignment',
      header: t('adminDocumentReviewColumnAssignment'),
      render: (row) => row.assignment.referenceNumber,
    },
    {
      key: 'project',
      header: t('adminDocumentReviewColumnProject'),
      render: (row) => referenceDisplayName(row.assignment.project, t('adminDocumentReviewNameUnavailable')),
    },
    {
      key: 'country',
      header: t('adminDocumentReviewColumnCountry'),
      render: (row) => referenceDisplayName(row.assignment.country, t('adminDocumentReviewNameUnavailable')),
    },
    {
      key: 'craft',
      header: t('adminDocumentReviewColumnCraft'),
      render: (row) => referenceDisplayName(row.assignment.craft, t('adminDocumentReviewNameUnavailable')),
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
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">{t('adminDocumentReviewQueueTitle')}</h1>
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-wrap gap-2">
            {FILTERABLE_REVIEW_STATES.map((status) => (
              <FilterChip key={status} selected={(filters.status ?? []).includes(status)} onClick={() => toggleStatus(status)}>
                {t(REVIEW_STATE_KEYS[status])}
              </FilterChip>
            ))}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        </div>
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

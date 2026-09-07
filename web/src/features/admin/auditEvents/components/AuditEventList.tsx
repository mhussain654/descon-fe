import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router';
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
import { AUDIT_EVENT_ERROR_KEYS } from '../../../../../../shared/adminAuditEvents/errorMessages';
import type { AuditEvent, AuditEventListFilters, AuditEventListSort } from '../../../../lib/admin-audit-events-client';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import { useAuditEventList } from '../hooks/useAuditEventList';
import {
  DEFAULT_PAGE_SIZE,
  readAuditEventListStateFromSearchParams,
  writeAuditEventListStateToSearchParams,
} from '../auditEventListUrlState';

/** Renders metadata as a compact, read-only key/value listing -- never a raw JSON blob, and never an editable field (this explorer has no edit affordance anywhere, matching the backend's read-only-by-design route). */
function MetadataSummary({ metadata }: { metadata: Record<string, unknown> }) {
  const entries = Object.entries(metadata);
  if (entries.length === 0) return <span className="text-text-tertiary">—</span>;

  return (
    <dl className="space-y-0.5 text-xs">
      {entries.map(([key, value]) => (
        <div key={key} className="flex gap-1">
          <dt className="font-medium text-text-tertiary">{key}:</dt>
          <dd className="truncate text-text-secondary">{String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The audit explorer: filters, sort and pagination, all backed by the URL
 * -- mirrors PaymentTransactionList.tsx's identical structure. No
 * RequireStaffAuth permission prop on this route -- gating happens here via
 * the query's own FORBIDDEN state, same as PaymentTransactionList.
 */
export function AuditEventList() {
  const { t, language } = useLanguage();
  const { signOut } = useStaffAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters, sort, page } = readAuditEventListStateFromSearchParams(searchParams);

  const query = useAuditEventList(filters, sort, page);

  useEffect(() => {
    if (query.error?.code === 'SESSION_EXPIRED') {
      signOut('expired');
    } else if (query.error?.code === 'INACTIVE_ACCOUNT') {
      signOut('manual');
    }
  }, [query.error, signOut]);

  const updateFilters = useCallback(
    (patch: Partial<AuditEventListFilters>, nextSort: AuditEventListSort | undefined = sort) => {
      const nextFilters = { ...filters, ...patch };
      setSearchParams(writeAuditEventListStateToSearchParams(nextFilters, nextSort, { ...page, number: 1 }));
    },
    [filters, sort, page, setSearchParams]
  );

  const clearFilters = () => setSearchParams(new URLSearchParams());

  const hasActiveFilters = Boolean(
    filters.actor || filters.action || filters.entityType || filters.candidate || filters.occurredFrom || filters.occurredTo || sort
  );

  const columns: DataTableColumn<AuditEvent>[] = [
    {
      key: 'occurred',
      header: t('adminAuditEventColumnOccurred'),
      render: (row) => formatDate(row.occurredAt, language, { dateStyle: 'medium', timeStyle: 'short' }),
    },
    {
      key: 'actor',
      header: t('adminAuditEventColumnActor'),
      render: (row) =>
        row.actor ? (
          <div>
            <div className="font-medium text-text-primary">{row.actor.role}</div>
            <div className="text-xs text-text-tertiary">{row.actor.id}</div>
          </div>
        ) : (
          <span className="text-text-tertiary">{t('adminAuditEventSystemActor')}</span>
        ),
    },
    {
      key: 'action',
      header: t('adminAuditEventColumnAction'),
      render: (row) => <Badge tone="neutral">{row.actionCode}</Badge>,
    },
    {
      key: 'entity',
      header: t('adminAuditEventColumnEntity'),
      render: (row) => (
        <div>
          <div className="text-text-primary">{row.entityType}</div>
          {row.candidateId ? <div className="text-xs text-text-tertiary">{row.candidateId}</div> : null}
        </div>
      ),
    },
    {
      key: 'details',
      header: t('adminAuditEventColumnDetails'),
      render: (row) => <MetadataSummary metadata={row.metadata} />,
    },
  ];

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">{t('adminAuditEventTitle')}</h1>
        <p className="text-sm text-text-secondary">{t('adminAuditEventSubtitle')}</p>
      </div>

      <Card className="mb-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            label={t('adminAuditEventFilterActorLabel')}
            placeholder={t('adminAuditEventFilterActorPlaceholder')}
            value={filters.actor ?? ''}
            onChange={(event) => updateFilters({ actor: event.target.value || undefined })}
          />
          <Input
            label={t('adminAuditEventFilterActionLabel')}
            placeholder={t('adminAuditEventFilterActionPlaceholder')}
            value={filters.action ?? ''}
            onChange={(event) => updateFilters({ action: event.target.value || undefined })}
          />
          <Input
            label={t('adminAuditEventFilterEntityTypeLabel')}
            placeholder={t('adminAuditEventFilterEntityTypePlaceholder')}
            value={filters.entityType ?? ''}
            onChange={(event) => updateFilters({ entityType: event.target.value || undefined })}
          />
          <Input
            label={t('adminAuditEventFilterCandidateLabel')}
            placeholder={t('adminAuditEventFilterCandidatePlaceholder')}
            value={filters.candidate ?? ''}
            onChange={(event) => updateFilters({ candidate: event.target.value || undefined })}
          />
          <Input
            type="date"
            label={t('adminAuditEventFilterFromLabel')}
            value={filters.occurredFrom ?? ''}
            onChange={(event) => updateFilters({ occurredFrom: event.target.value || undefined })}
          />
          <Input
            type="date"
            label={t('adminAuditEventFilterToLabel')}
            value={filters.occurredTo ?? ''}
            onChange={(event) => updateFilters({ occurredTo: event.target.value || undefined })}
          />
          <Select
            label={t('adminAuditEventSortLabel')}
            value={sort ?? ''}
            onChange={(event) => updateFilters({}, (event.target.value || undefined) as AuditEventListSort | undefined)}
            options={[
              { value: '', label: t('adminAuditEventSortOccurredDesc') },
              { value: 'occurred_at', label: t('adminAuditEventSortOccurredAsc') },
            ]}
          />
        </div>
        {hasActiveFilters ? (
          <div className="mt-4">
            <button type="button" onClick={clearFilters} className="text-sm font-medium text-brand hover:underline">
              {t('adminAuditEventClearFilters')}
            </button>
          </div>
        ) : null}
      </Card>

      <ListContent
        query={query}
        columns={columns}
        page={page}
        onPageChange={(number) => setSearchParams(writeAuditEventListStateToSearchParams(filters, sort, { ...page, number }))}
        hasActiveFilters={hasActiveFilters}
        t={t}
      />
    </div>
  );
}

interface ListContentProps {
  query: ReturnType<typeof useAuditEventList>;
  columns: DataTableColumn<AuditEvent>[];
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
      return <ForbiddenState title={t('dsForbiddenTitle')} description={t('dsForbiddenDescription')} />;
    }
    if (error?.code === 'SESSION_EXPIRED' || error?.code === 'INACTIVE_ACCOUNT') {
      // signOut() (triggered above) hands off to RequireStaffAuth's own redirect -- nothing further to render here.
      return null;
    }
    const messageKey = (error ? AUDIT_EVENT_ERROR_KEYS[error.code] : 'somethingWentWrong') as TranslationKey;
    return <ErrorState message={error?.message || t(messageKey)} retryLabel={t('retry')} onRetry={() => query.refetch()} />;
  }

  const result = query.data;
  const items = result?.items ?? [];
  const pagination = result?.pagination;

  if (items.length === 0) {
    return hasActiveFilters ? (
      <EmptyState title={t('adminAuditEventEmptyFilteredTitle')} description={t('adminAuditEventEmptyFilteredDescription')} />
    ) : (
      <EmptyState title={t('adminAuditEventEmptyTitle')} description={t('adminAuditEventEmptyDescription')} />
    );
  }

  return (
    <div>
      {query.isError ? (
        <div className="mb-4">
          <RetryBanner message={t('adminAuditEventLoadError')} retryLabel={t('retry')} onRetry={() => query.refetch()} />
        </div>
      ) : null}
      <Card noPadding>
        <DataTable columns={columns} rows={items} getRowId={(row) => String(row.id)} />
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

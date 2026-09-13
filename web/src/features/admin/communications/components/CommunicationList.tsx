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
import { COMMUNICATION_ERROR_KEYS } from '../../../../../../shared/adminCommunications/errorMessages';
import {
  communicationChannelLabel,
  communicationStatusLabel,
  communicationStatusTone,
} from '../../../../../../shared/adminCommunications/communicationLabels';
import type { Communication, CommunicationListFilters, CommunicationListSort } from '../../../../lib/admin-communications-client';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import { useCommunicationList } from '../hooks/useCommunicationList';
import {
  DEFAULT_PAGE_SIZE,
  readCommunicationListStateFromSearchParams,
  writeCommunicationListStateToSearchParams,
} from '../communicationListUrlState';

/**
 * The communications log: filters, sort and pagination, all backed by the
 * URL -- mirrors AuditEventList.tsx's identical structure. No
 * RequireStaffAuth permission prop on this route -- gating happens here via
 * the query's own FORBIDDEN state, same as AuditEventList.
 */
export function CommunicationList() {
  const { t, language } = useLanguage();
  const { signOut } = useStaffAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters, sort, page } = readCommunicationListStateFromSearchParams(searchParams);

  const query = useCommunicationList(filters, sort, page);

  useEffect(() => {
    if (query.error?.code === 'SESSION_EXPIRED') {
      signOut('expired');
    } else if (query.error?.code === 'INACTIVE_ACCOUNT') {
      signOut('manual');
    }
  }, [query.error, signOut]);

  const updateFilters = useCallback(
    (patch: Partial<CommunicationListFilters>, nextSort: CommunicationListSort | undefined = sort) => {
      const nextFilters = { ...filters, ...patch };
      setSearchParams(writeCommunicationListStateToSearchParams(nextFilters, nextSort, { ...page, number: 1 }));
    },
    [filters, sort, page, setSearchParams]
  );

  const clearFilters = () => setSearchParams(new URLSearchParams());

  const hasActiveFilters = Boolean(
    filters.channel ||
      filters.direction ||
      filters.status ||
      filters.candidateAssignment ||
      filters.candidate ||
      filters.occurredFrom ||
      filters.occurredTo ||
      sort
  );

  const columns: DataTableColumn<Communication>[] = [
    {
      key: 'created',
      header: t('adminCommunicationColumnCreated'),
      render: (row) => formatDate(row.createdAt, language, { dateStyle: 'medium', timeStyle: 'short' }),
    },
    {
      key: 'channel',
      header: t('adminCommunicationColumnChannel'),
      render: (row) => <Badge tone="brand">{communicationChannelLabel(row.channelCode, t)}</Badge>,
    },
    {
      key: 'direction',
      header: t('adminCommunicationColumnDirection'),
      render: (row) =>
        row.directionCode === 'inbound' ? t('adminCommunicationDirectionInbound') : t('adminCommunicationDirectionOutbound'),
    },
    {
      key: 'status',
      header: t('adminCommunicationColumnStatus'),
      render: (row) => <Badge tone={communicationStatusTone(row.statusCode)}>{communicationStatusLabel(row.statusCode, t)}</Badge>,
    },
    {
      key: 'candidate',
      header: t('adminCommunicationColumnCandidate'),
      render: (row) =>
        row.candidateAssignment ? (
          <Link to={`/admin/candidates/${row.candidateAssignment.candidateId}`} className="font-medium text-brand hover:underline">
            {row.candidateAssignment.referenceNumber}
          </Link>
        ) : (
          <span className="text-text-tertiary">—</span>
        ),
    },
    {
      key: 'recipient',
      header: t('adminCommunicationColumnRecipient'),
      render: (row) => row.recipientMasked || <span className="text-text-tertiary">—</span>,
    },
    {
      key: 'initiatedBy',
      header: t('adminCommunicationColumnInitiatedBy'),
      render: (row) =>
        row.initiatedBy ? (
          <div>
            <div className="font-medium text-text-primary">{row.initiatedBy.role}</div>
            <div className="text-xs text-text-tertiary">{row.initiatedBy.id}</div>
          </div>
        ) : (
          <span className="text-text-tertiary">{t('adminCommunicationSystemActor')}</span>
        ),
    },
    {
      key: 'error',
      header: t('adminCommunicationColumnError'),
      render: (row) => (row.errorCode ? <Badge tone="danger">{row.errorCode}</Badge> : <span className="text-text-tertiary">—</span>),
    },
  ];

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">{t('adminCommunicationTitle')}</h1>
        <p className="text-sm text-text-secondary">{t('adminCommunicationSubtitle')}</p>
      </div>

      <Card className="mb-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            label={t('adminCommunicationFilterChannelLabel')}
            placeholder={t('adminCommunicationFilterChannelPlaceholder')}
            value={filters.channel ?? ''}
            onChange={(event) => updateFilters({ channel: event.target.value || undefined })}
          />
          <Select
            label={t('adminCommunicationFilterDirectionLabel')}
            value={filters.direction ?? ''}
            onChange={(event) =>
              updateFilters({ direction: (event.target.value || undefined) as CommunicationListFilters['direction'] })
            }
            options={[
              { value: '', label: t('adminCommunicationFilterDirectionAll') },
              { value: 'inbound', label: t('adminCommunicationDirectionInbound') },
              { value: 'outbound', label: t('adminCommunicationDirectionOutbound') },
            ]}
          />
          <Input
            label={t('adminCommunicationFilterStatusLabel')}
            placeholder={t('adminCommunicationFilterStatusPlaceholder')}
            value={filters.status ?? ''}
            onChange={(event) => updateFilters({ status: event.target.value || undefined })}
          />
          <Input
            label={t('adminCommunicationFilterAssignmentLabel')}
            placeholder={t('adminCommunicationFilterAssignmentPlaceholder')}
            value={filters.candidateAssignment ?? ''}
            onChange={(event) => updateFilters({ candidateAssignment: event.target.value || undefined })}
          />
          <Input
            label={t('adminCommunicationFilterCandidateLabel')}
            placeholder={t('adminCommunicationFilterCandidatePlaceholder')}
            value={filters.candidate ?? ''}
            onChange={(event) => updateFilters({ candidate: event.target.value || undefined })}
          />
          <Input
            type="date"
            label={t('adminCommunicationFilterFromLabel')}
            value={filters.occurredFrom ?? ''}
            onChange={(event) => updateFilters({ occurredFrom: event.target.value || undefined })}
          />
          <Input
            type="date"
            label={t('adminCommunicationFilterToLabel')}
            value={filters.occurredTo ?? ''}
            onChange={(event) => updateFilters({ occurredTo: event.target.value || undefined })}
          />
          <Select
            label={t('adminCommunicationSortLabel')}
            value={sort ?? ''}
            onChange={(event) => updateFilters({}, (event.target.value || undefined) as CommunicationListSort | undefined)}
            options={[
              { value: '', label: t('adminCommunicationSortCreatedDesc') },
              { value: 'created_at', label: t('adminCommunicationSortCreatedAsc') },
            ]}
          />
        </div>
        {hasActiveFilters ? (
          <div className="mt-4">
            <button type="button" onClick={clearFilters} className="text-sm font-medium text-brand hover:underline">
              {t('adminCommunicationClearFilters')}
            </button>
          </div>
        ) : null}
      </Card>

      <ListContent
        query={query}
        columns={columns}
        page={page}
        onPageChange={(number) => setSearchParams(writeCommunicationListStateToSearchParams(filters, sort, { ...page, number }))}
        hasActiveFilters={hasActiveFilters}
        t={t}
      />
    </div>
  );
}

interface ListContentProps {
  query: ReturnType<typeof useCommunicationList>;
  columns: DataTableColumn<Communication>[];
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
    const messageKey = (error ? COMMUNICATION_ERROR_KEYS[error.code] : 'somethingWentWrong') as TranslationKey;
    return <ErrorState message={error?.message || t(messageKey)} retryLabel={t('retry')} onRetry={() => query.refetch()} />;
  }

  const result = query.data;
  const items = result?.items ?? [];
  const pagination = result?.pagination;

  if (items.length === 0) {
    return hasActiveFilters ? (
      <EmptyState title={t('adminCommunicationEmptyFilteredTitle')} description={t('adminCommunicationEmptyFilteredDescription')} />
    ) : (
      <EmptyState title={t('adminCommunicationEmptyTitle')} description={t('adminCommunicationEmptyDescription')} />
    );
  }

  return (
    <div>
      {query.isError ? (
        <div className="mb-4">
          <RetryBanner message={t('adminCommunicationLoadError')} retryLabel={t('retry')} onRetry={() => query.refetch()} />
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

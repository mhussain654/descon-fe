import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowDownLeft, ArrowUpRight, ChevronDown, MessageSquareText, PhoneCall, Radio, SlidersHorizontal } from 'lucide-react';
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
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

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

  const items = query.data?.items ?? [];
  const pageSummary = {
    total: query.data?.pagination.totalCount ?? 0,
    outbound: items.filter((item) => item.directionCode === 'outbound').length,
    inbound: items.filter((item) => item.directionCode === 'inbound').length,
    aiCalls: items.filter((item) => item.channelCode === 'ai_voice_call').length,
  };

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6">
      <div className="relative mb-5 overflow-hidden rounded-2xl bg-brand shadow-md">
        <div aria-hidden="true" className="absolute -right-14 -top-20 h-52 w-52 rounded-full border-[28px] border-white/10" />
        <div aria-hidden="true" className="absolute -bottom-16 right-40 h-36 w-36 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-4 px-6 py-7 lg:px-8">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
            <MessageSquareText className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="max-w-3xl">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/70">{t('adminCommunicationEyebrow')}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{t('adminCommunicationTitle')}</h1>
            <p className="mt-1 text-sm leading-6 text-white/80">{t('adminCommunicationSubtitle')}</p>
          </div>
        </div>
      </div>

      {!query.isLoading && query.data ? (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: t('adminCommunicationMetricTotal'), value: pageSummary.total, icon: Radio, style: 'border-t-brand bg-brand-subtle/45 text-brand' },
            { label: t('adminCommunicationMetricOutbound'), value: pageSummary.outbound, icon: ArrowUpRight, style: 'border-t-info bg-info-subtle/55 text-info-emphasis' },
            { label: t('adminCommunicationMetricInbound'), value: pageSummary.inbound, icon: ArrowDownLeft, style: 'border-t-success bg-success-subtle/55 text-success-emphasis' },
            { label: t('adminCommunicationMetricAiCalls'), value: pageSummary.aiCalls, icon: PhoneCall, style: 'border-t-warning bg-warning-subtle/60 text-warning-emphasis' },
          ].map(({ label, value, icon: Icon, style }) => (
            <div key={label} className={`rounded-xl border border-border border-t-4 p-4 shadow-sm ${style}`}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{label}</span>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="text-2xl font-semibold tracking-tight text-text-primary">{value}</div>
            </div>
          ))}
        </div>
      ) : null}

      <Card className="mb-5 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-text-primary">{t('adminCommunicationFilterTitle')}</h2>
            <p className="text-xs text-text-secondary">{t('adminCommunicationFilterDescription')}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowAdvancedFilters((current) => !current)}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-text-secondary transition hover:bg-surface-sunken"
            aria-expanded={showAdvancedFilters}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            {t('adminCommunicationAdvancedFilters')}
            <ChevronDown className={`h-4 w-4 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        </div>
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
            label={t('adminCommunicationFilterCandidateLabel')}
            placeholder={t('adminCommunicationFilterCandidatePlaceholder')}
            value={filters.candidate ?? ''}
            onChange={(event) => updateFilters({ candidate: event.target.value || undefined })}
          />
        </div>
        {showAdvancedFilters ? (
          <div className="mt-4 grid grid-cols-1 gap-4 border-t border-border-subtle pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              label={t('adminCommunicationFilterAssignmentLabel')}
              placeholder={t('adminCommunicationFilterAssignmentPlaceholder')}
              value={filters.candidateAssignment ?? ''}
              onChange={(event) => updateFilters({ candidateAssignment: event.target.value || undefined })}
            />
            <Input type="date" label={t('adminCommunicationFilterFromLabel')} value={filters.occurredFrom ?? ''} onChange={(event) => updateFilters({ occurredFrom: event.target.value || undefined })} />
            <Input type="date" label={t('adminCommunicationFilterToLabel')} value={filters.occurredTo ?? ''} onChange={(event) => updateFilters({ occurredTo: event.target.value || undefined })} />
            <Select
              label={t('adminCommunicationSortLabel')}
              value={sort ?? ''}
              onChange={(event) => updateFilters({}, (event.target.value || undefined) as CommunicationListSort | undefined)}
              options={[{ value: '', label: t('adminCommunicationSortCreatedDesc') }, { value: 'created_at', label: t('adminCommunicationSortCreatedAsc') }]}
            />
          </div>
        ) : null}
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

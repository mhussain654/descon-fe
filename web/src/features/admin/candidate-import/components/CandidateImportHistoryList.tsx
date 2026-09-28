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
import { CANDIDATE_IMPORT_ERROR_KEYS } from '../../../../../../shared/adminCandidateImport/errorMessages';
import { formatDate } from '../../../../../../shared/i18n/locale';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import type {
  CandidateImportBatchSummary,
  CandidateImportHistoryFilters,
  CandidateImportStatus,
  CandidateImportStatusSummaryRow,
} from '../../../../lib/candidate-import-client';
import { CategoryDonutChart, type ChartTone } from '../../reports/components/ReportCharts';
import { useCandidateImportHistory } from '../hooks/useCandidateImportHistory';
import { DEFAULT_PAGE_SIZE, readHistoryStateFromSearchParams, writeHistoryStateToSearchParams } from '../historyUrlState';
import { AlertTriangle, ArrowLeft, Ban, CheckCircle2, Clock, FileClock, RefreshCw, XCircle } from 'lucide-react';

const STATUSES: CandidateImportStatus[] = ['queued', 'processing', 'completed', 'partial', 'failed', 'invalidated'];

const STATUS_LABEL_KEYS: Record<CandidateImportStatus, TranslationKey> = {
  queued: 'adminCandidateImportStatusQueued',
  processing: 'adminCandidateImportStatusProcessing',
  completed: 'adminCandidateImportStatusCompleted',
  partial: 'adminCandidateImportStatusPartial',
  failed: 'adminCandidateImportStatusFailed',
  invalidated: 'adminCandidateImportStatusInvalidated',
};

const STATUS_TONES: Record<CandidateImportStatus, ChartTone> = {
  queued: 'info',
  processing: 'info',
  completed: 'success',
  partial: 'warning',
  failed: 'danger',
  invalidated: 'neutral',
};

const STATUS_ICON: Record<CandidateImportStatus, typeof Clock> = {
  queued: Clock,
  processing: RefreshCw,
  completed: CheckCircle2,
  partial: AlertTriangle,
  failed: XCircle,
  invalidated: Ban,
};

// Literal class strings per tone -- Tailwind's JIT scanner needs each class
// name written out in source, not templated (AGENTS.md).
const STATUS_TILE_CLASSNAME: Record<ChartTone, string> = {
  brand: 'border-t-brand bg-brand-subtle/55 text-brand',
  success: 'border-t-success bg-success-subtle/55 text-success-emphasis',
  warning: 'border-t-warning bg-warning-subtle/55 text-warning-emphasis',
  danger: 'border-t-danger bg-danger-subtle/55 text-danger-emphasis',
  info: 'border-t-info bg-info-subtle/55 text-info-emphasis',
  neutral: 'border-t-border bg-surface-sunken text-text-secondary',
};

/** The candidate manager's own import history: filters, table and pagination, all backed by the URL -- mirrors CandidateListWorkspace.tsx's/DocumentReviewQueue.tsx's identical structure. */
export function CandidateImportHistoryList() {
  const { t, language } = useLanguage();
  const { signOut } = useStaffAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters, page } = readHistoryStateFromSearchParams(searchParams);

  const query = useCandidateImportHistory(filters, page);

  useEffect(() => {
    if (query.error?.code === 'SESSION_EXPIRED') {
      signOut('expired');
    } else if (query.error?.code === 'INACTIVE_ACCOUNT') {
      signOut('manual');
    }
  }, [query.error, signOut]);

  const updateFilters = useCallback(
    (patch: Partial<CandidateImportHistoryFilters>) => {
      const nextFilters = { ...filters, ...patch };
      setSearchParams(writeHistoryStateToSearchParams(nextFilters, { ...page, number: 1 }));
    },
    [filters, page, setSearchParams]
  );

  const clearFilters = () => setSearchParams(new URLSearchParams());

  const hasActiveFilters = Boolean(filters.status || filters.createdFrom || filters.createdTo || filters.templateVersion);

  const columns: DataTableColumn<CandidateImportBatchSummary>[] = [
    {
      key: 'file',
      header: t('adminCandidateImportHistoryColumnFile'),
      render: (row) => (
        <Link to={`/admin/candidates/import/${row.id}`} className="font-medium text-brand hover:underline">
          {row.sourceFilename}
        </Link>
      ),
    },
    {
      key: 'status',
      header: t('adminCandidateImportHistoryColumnStatus'),
      render: (row) => <Badge tone={STATUS_TONES[row.status]}>{t(STATUS_LABEL_KEYS[row.status])}</Badge>,
    },
    { key: 'total', header: t('adminCandidateImportTotalRowsLabel'), render: (row) => row.totalRows },
    { key: 'imported', header: t('adminCandidateImportSuccessfulRowsLabel'), render: (row) => row.importedRows },
    {
      key: 'submitted',
      header: t('adminCandidateImportHistoryColumnSubmitted'),
      render: (row) => formatDate(row.createdAt, language, { dateStyle: 'medium', timeStyle: 'short' }),
    },
  ];

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-5 sm:px-6 sm:py-6">
      <div className="relative mb-5 overflow-hidden rounded-2xl bg-brand shadow-md"><div aria-hidden="true" className="absolute -right-14 -top-20 h-52 w-52 rounded-full border-[28px] border-white/10" /><div className="relative flex flex-col gap-5 px-6 py-7 sm:flex-row sm:items-center sm:justify-between lg:px-8"><div className="flex items-center gap-4"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-white"><FileClock className="h-5 w-5" /></div><div><p className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/70">{t('adminCandidateImportHistoryEyebrow')}</p><h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{t('adminCandidateImportHistoryTitle')}</h1></div></div><Link to="/admin/candidates/import" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/25 bg-white/10 px-4 text-sm font-medium text-white hover:bg-white/20"><ArrowLeft className="me-2 h-4 w-4" />{t('adminCandidateImportBackToImport')}</Link></div></div>

      <Card className="mb-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label={t('adminCandidateImportHistoryFilterStatusLabel')}
            value={filters.status ?? ''}
            onChange={(event) => updateFilters({ status: (event.target.value || undefined) as CandidateImportStatus | undefined })}
            options={[
              { value: '', label: t('adminCandidateImportHistoryFilterAllStatuses') },
              ...STATUSES.map((status) => ({ value: status, label: t(STATUS_LABEL_KEYS[status]) })),
            ]}
          />
          <Input
            type="date"
            label={t('adminCandidateImportHistoryFilterCreatedFromLabel')}
            value={filters.createdFrom ?? ''}
            onChange={(event) => updateFilters({ createdFrom: event.target.value || undefined })}
          />
          <Input
            type="date"
            label={t('adminCandidateImportHistoryFilterCreatedToLabel')}
            value={filters.createdTo ?? ''}
            onChange={(event) => updateFilters({ createdTo: event.target.value || undefined })}
          />
          <Input
            label={t('adminCandidateImportHistoryFilterTemplateVersionLabel')}
            value={filters.templateVersion ?? ''}
            onChange={(event) => updateFilters({ templateVersion: event.target.value || undefined })}
          />
        </div>
        {hasActiveFilters ? (
          <div className="mt-4">
            <button type="button" onClick={clearFilters} className="text-sm font-medium text-brand hover:underline">
              {t('adminCandidateImportHistoryClearFilters')}
            </button>
          </div>
        ) : null}
      </Card>

      <HistorySummary summary={query.data?.summary} t={t} />

      <HistoryContent
        query={query}
        columns={columns}
        page={page}
        onPageChange={(number) => setSearchParams(writeHistoryStateToSearchParams(filters, { ...page, number }))}
        hasActiveFilters={hasActiveFilters}
        t={t}
      />
    </div>
  );
}

function HistorySummary({ summary, t }: { summary?: CandidateImportStatusSummaryRow[]; t: (key: TranslationKey) => string }) {
  if (!summary || summary.length === 0) return null;

  const hasAnyCount = summary.some((row) => row.count > 0);
  if (!hasAnyCount) return null;

  return (
    <Card className="mb-4 p-5">
      <h2 className="mb-3 font-semibold text-text-primary">{t('adminCandidateImportSummaryTitle')}</h2>
      <div className="grid items-center gap-5 sm:grid-cols-[170px_minmax(0,1fr)]">
        <div className="relative mx-auto">
          <CategoryDonutChart
            data={summary.map((row) => ({ key: row.code, label: t(STATUS_LABEL_KEYS[row.code]), value: row.count, tone: STATUS_TONES[row.code] }))}
          />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold tracking-tight text-text-primary">{summary.reduce((sum, row) => sum + row.count, 0)}</span>
            <span className="text-[11px] font-medium text-text-tertiary">{t('adminCandidateImportTotalRowsLabel')}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {summary.map((row) => {
            const Icon = STATUS_ICON[row.code];
            return (
              <div
                key={row.code}
                className={`rounded-xl border border-t-4 p-4 shadow-sm ${STATUS_TILE_CLASSNAME[STATUS_TONES[row.code]]}`}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{t(STATUS_LABEL_KEYS[row.code])}</span>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="text-2xl font-semibold text-text-primary">{row.count}</div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

interface HistoryContentProps {
  query: ReturnType<typeof useCandidateImportHistory>;
  columns: DataTableColumn<CandidateImportBatchSummary>[];
  page: { number?: number; size?: number };
  onPageChange: (page: number) => void;
  hasActiveFilters: boolean;
  t: (key: TranslationKey) => string;
}

function HistoryContent({ query, columns, page, onPageChange, hasActiveFilters, t }: HistoryContentProps) {
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
      return null;
    }
    const messageKey = (error ? CANDIDATE_IMPORT_ERROR_KEYS[error.code] : 'somethingWentWrong') as TranslationKey;
    return <ErrorState message={error?.message || t(messageKey)} retryLabel={t('retry')} onRetry={() => query.refetch()} />;
  }

  const result = query.data;
  const items = result?.items ?? [];
  const pagination = result?.pagination;

  if (items.length === 0) {
    return hasActiveFilters ? (
      <EmptyState title={t('adminCandidateImportHistoryEmptyFilteredTitle')} description={t('adminCandidateImportHistoryEmptyFilteredDescription')} />
    ) : (
      <EmptyState title={t('adminCandidateImportHistoryEmptyTitle')} description={t('adminCandidateImportHistoryEmptyDescription')} />
    );
  }

  return (
    <div>
      {query.isError ? (
        <div className="mb-4">
          <RetryBanner message={t('adminCandidateImportHistoryLoadError')} retryLabel={t('retry')} onRetry={() => query.refetch()} />
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

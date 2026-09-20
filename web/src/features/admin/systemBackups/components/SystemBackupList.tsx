import { useEffect, useState } from 'react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
  OfflineState,
  Pagination,
  RetryBanner,
  ValidationMessage,
  type DataTableColumn,
} from '../../../../design-system';
import { formatDate } from '../../../../../../shared/i18n/locale';
import { formatFileSize } from '../../../../../../shared/candidateDocuments/formatting';
import { SYSTEM_BACKUP_ERROR_KEYS } from '../../../../../../shared/adminSystemBackups/errorMessages';
import type { SystemBackup } from '../../../../lib/admin-system-backups-client';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import { useSystemBackupList } from '../hooks/useSystemBackupList';
import { useBackupDownload } from '../hooks/useBackupDownload';
import { CheckCircle2, DatabaseBackup, Download, HardDrive, XCircle } from 'lucide-react';

const STATUS_TONE = {
  succeeded: 'success',
  failed: 'danger',
  in_progress: 'neutral',
} as const;

/**
 * The admin backup browser (MPS-903): a read-only, paginated list of daily
 * database backup attempts with a Download action per succeeded row. No
 * filters/sort -- unlike the audit explorer, there's nothing to filter by
 * yet (one row per day) and the backend query only supports pagination.
 */
export function SystemBackupList() {
  const { t, language } = useLanguage();
  const { signOut } = useStaffAuth();
  const [pageNumber, setPageNumber] = useState(1);
  const query = useSystemBackupList({ number: pageNumber });
  const { downloadBackup, isPending: isDownloading, variables: downloadingId, error: downloadError } = useBackupDownload();

  useEffect(() => {
    if (query.error?.code === 'SESSION_EXPIRED') {
      signOut('expired');
    } else if (query.error?.code === 'INACTIVE_ACCOUNT') {
      signOut('manual');
    }
  }, [query.error, signOut]);

  const columns: DataTableColumn<SystemBackup>[] = [
    {
      key: 'taken_at',
      header: t('adminSystemBackupColumnTakenAt'),
      render: (row) => formatDate(row.takenAt, language, { dateStyle: 'medium', timeStyle: 'short' }),
    },
    {
      key: 'status',
      header: t('adminSystemBackupColumnStatus'),
      render: (row) => <Badge tone={STATUS_TONE[row.status]}>{t(`adminSystemBackupStatus_${row.status}` as TranslationKey)}</Badge>,
    },
    {
      key: 'size',
      header: t('adminSystemBackupColumnSize'),
      render: (row) => (row.byteSize != null ? formatFileSize(row.byteSize, language) : '—'),
    },
    {
      key: 'duration',
      header: t('adminSystemBackupColumnDuration'),
      render: (row) => (row.durationSeconds != null ? t('adminSystemBackupDurationSeconds').replace('%{count}', String(row.durationSeconds)) : '—'),
    },
    {
      key: 'action',
      header: t('adminSystemBackupColumnAction'),
      render: (row) =>
        row.status === 'succeeded' ? (
          <Button
            variant="outline"
            size="sm"
            loading={isDownloading && downloadingId === row.id}
            onClick={() => downloadBackup(row.id)}
          >
            <Download className="me-1.5 h-4 w-4" aria-hidden="true" />
            {t('adminSystemBackupDownloadAction')}
          </Button>
        ) : (
          <span className="text-text-tertiary">{row.errorMessage ?? '—'}</span>
        ),
    },
  ];

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-5 sm:px-6 sm:py-6">
      <div className="relative mb-5 overflow-hidden rounded-2xl bg-brand shadow-md"><div aria-hidden="true" className="absolute -right-14 -top-20 h-52 w-52 rounded-full border-[28px] border-white/10" /><div className="relative flex items-center gap-4 px-6 py-7 lg:px-8"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-white"><DatabaseBackup className="h-5 w-5" /></div><div><p className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/70">{t('adminSystemBackupEyebrow')}</p><h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{t('adminSystemBackupTitle')}</h1><p className="mt-1 text-sm text-white/80">{t('adminSystemBackupSubtitle')}</p></div></div></div>

      {query.data ? <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3"><BackupMetric icon={HardDrive} label={t('adminSystemBackupMetricTotal')} value={query.data.pagination.totalCount} className="border-t-brand bg-brand-subtle/45 text-brand" /><BackupMetric icon={CheckCircle2} label={t('adminSystemBackupMetricSucceeded')} value={query.data.items.filter((item) => item.status === 'succeeded').length} className="border-t-success bg-success-subtle/55 text-success-emphasis" /><BackupMetric icon={XCircle} label={t('adminSystemBackupMetricFailed')} value={query.data.items.filter((item) => item.status === 'failed').length} className="border-t-danger bg-danger-subtle/55 text-danger-emphasis" /></div> : null}

      {downloadError ? (
        <div className="mb-4">
          <ValidationMessage tone="error">
            {downloadError.message || t(SYSTEM_BACKUP_ERROR_KEYS[downloadError.code] as TranslationKey)}
          </ValidationMessage>
        </div>
      ) : null}

      <ListContent query={query} columns={columns} page={pageNumber} onPageChange={setPageNumber} t={t} />
    </div>
  );
}

function BackupMetric({ icon: Icon, label, value, className }: { icon: typeof HardDrive; label: string; value: number; className: string }) {
  return <div className={`rounded-xl border border-border border-t-4 p-4 shadow-sm ${className}`}><div className="mb-3 flex items-center justify-between gap-3"><span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{label}</span><Icon className="h-4 w-4" /></div><div className="text-2xl font-semibold text-text-primary">{value}</div></div>;
}

interface ListContentProps {
  query: ReturnType<typeof useSystemBackupList>;
  columns: DataTableColumn<SystemBackup>[];
  page: number;
  onPageChange: (page: number) => void;
  t: (key: TranslationKey) => string;
}

function ListContent({ query, columns, page, onPageChange, t }: ListContentProps) {
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
    const messageKey = (error ? SYSTEM_BACKUP_ERROR_KEYS[error.code] : 'somethingWentWrong') as TranslationKey;
    return <ErrorState message={error?.message || t(messageKey)} retryLabel={t('retry')} onRetry={() => query.refetch()} />;
  }

  const result = query.data;
  const items = result?.items ?? [];
  const pagination = result?.pagination;

  if (items.length === 0) {
    return <EmptyState title={t('adminSystemBackupEmptyTitle')} description={t('adminSystemBackupEmptyDescription')} />;
  }

  return (
    <div>
      {query.isError ? (
        <div className="mb-4">
          <RetryBanner message={t('adminSystemBackupLoadError')} retryLabel={t('retry')} onRetry={() => query.refetch()} />
        </div>
      ) : null}
      <Card noPadding>
        <DataTable columns={columns} rows={items} getRowId={(row) => row.id} />
      </Card>
      {pagination ? (
        <div className="mt-4">
          <Pagination
            page={pagination.page || page}
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

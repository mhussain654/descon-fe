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
            {t('adminSystemBackupDownloadAction')}
          </Button>
        ) : (
          <span className="text-text-tertiary">{row.errorMessage ?? '—'}</span>
        ),
    },
  ];

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">{t('adminSystemBackupTitle')}</h1>
        <p className="text-sm text-text-secondary">{t('adminSystemBackupSubtitle')}</p>
      </div>

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

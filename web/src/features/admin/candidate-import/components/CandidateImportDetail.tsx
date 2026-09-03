import { useEffect } from 'react';
import { Link } from 'react-router';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
  OfflineState,
  ValidationMessage,
} from '../../../../design-system';
import { CANDIDATE_IMPORT_ERROR_KEYS } from '../../../../../../shared/adminCandidateImport/errorMessages';
import { formatDate } from '../../../../../../shared/i18n/locale';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import type { CandidateImportStatus } from '../../../../lib/candidate-import-client';
import { useCandidateImportBatch } from '../hooks/useCandidateImportBatch';
import { useErrorExportDownload } from '../hooks/useErrorExportDownload';
import { useRetryCandidateImport } from '../hooks/useRetryCandidateImport';
import { ImportRowResultsTable } from './ImportRowResultsTable';

const STATUS_LABEL_KEYS: Record<CandidateImportStatus, TranslationKey> = {
  queued: 'adminCandidateImportStatusQueued',
  processing: 'adminCandidateImportStatusProcessing',
  completed: 'adminCandidateImportStatusCompleted',
  partial: 'adminCandidateImportStatusPartial',
  failed: 'adminCandidateImportStatusFailed',
  invalidated: 'adminCandidateImportStatusInvalidated',
};

const STATUS_TONES: Record<CandidateImportStatus, 'info' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  queued: 'info',
  processing: 'info',
  completed: 'success',
  partial: 'warning',
  failed: 'danger',
  invalidated: 'neutral',
};

export interface CandidateImportDetailProps {
  importId: string;
}

/**
 * The batch detail/status page -- reached right after a commit's 202
 * (ticket: "Add import-detail/revisit navigation") and again any time later
 * from the import history list. The sole source of truth for what actually
 * happened: polls while queued/processing (useCandidateImportBatch), stops
 * automatically on any terminal status, and renders final counts/row
 * results only from this endpoint's own response, never from the commit
 * call that got the candidate manager here.
 */
export function CandidateImportDetail({ importId }: CandidateImportDetailProps) {
  const { t, language } = useLanguage();
  const { signOut } = useStaffAuth();
  const query = useCandidateImportBatch(importId);
  const retry = useRetryCandidateImport(importId);
  const errorExport = useErrorExportDownload(importId);

  useEffect(() => {
    const code = query.error?.code ?? retry.mutation.error?.code;
    if (code === 'SESSION_EXPIRED') {
      signOut('expired');
    } else if (code === 'INACTIVE_ACCOUNT') {
      signOut('manual');
    }
  }, [query.error, retry.mutation.error, signOut]);

  if (query.isLoading) {
    return <LoadingState message={t('loading')} />;
  }

  if (query.error?.code === 'SESSION_EXPIRED' || query.error?.code === 'INACTIVE_ACCOUNT') {
    return null;
  }

  if (query.error?.code === 'FORBIDDEN') {
    return <ForbiddenState title={t('dsForbiddenTitle')} description={t('dsForbiddenDescription')} />;
  }

  if (query.error?.code === 'NOT_FOUND') {
    return <EmptyState title={t('adminCandidateImportNotFoundTitle')} description={t('adminCandidateImportNotFoundDescription')} />;
  }

  if (query.error?.code === 'OFFLINE') {
    return (
      <OfflineState title={t('dsOfflineTitle')} description={t('dsOfflineDescription')} retryLabel={t('retry')} onRetry={() => query.refetch()} />
    );
  }

  if (query.error && !query.data) {
    const key = CANDIDATE_IMPORT_ERROR_KEYS[query.error.code] as TranslationKey;
    return <ErrorState message={query.error.message || t(key)} retryLabel={t('retry')} onRetry={() => query.refetch()} />;
  }

  if (!query.data) {
    return <ErrorState message={t('somethingWentWrong')} retryLabel={t('retry')} onRetry={() => query.refetch()} />;
  }

  const batch = query.data;
  const hasErrorsToDownload = batch.rejectedRows + batch.skippedRows > 0;

  return (
    <div className="space-y-5">
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-text-primary">{t('adminCandidateImportDetailTitle')}</h2>
          <Badge tone={STATUS_TONES[batch.status]}>{t(STATUS_LABEL_KEYS[batch.status])}</Badge>
        </div>

        <dl className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-text-tertiary">{t('adminCandidateImportFileLabel')}</dt>
            <dd className="text-sm text-text-primary">{batch.sourceFilename}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-tertiary">{t('adminCandidateImportSubmittedOnLabel')}</dt>
            <dd className="text-sm text-text-primary" dir="ltr">
              {formatDate(batch.createdAt, language, { dateStyle: 'medium', timeStyle: 'short' })}
            </dd>
          </div>
          {batch.processedAt ? (
            <div>
              <dt className="text-xs text-text-tertiary">{t('adminCandidateImportProcessedOnLabel')}</dt>
              <dd className="text-sm text-text-primary" dir="ltr">
                {formatDate(batch.processedAt, language, { dateStyle: 'medium', timeStyle: 'short' })}
              </dd>
            </div>
          ) : null}
        </dl>

        {batch.status === 'queued' ? (
          <div className="rounded-xl bg-[#FFF7E6] px-4 py-3 text-sm text-gray-700">{t('adminCandidateImportQueuedMessage')}</div>
        ) : null}
        {batch.status === 'processing' ? (
          <div className="rounded-xl bg-[#FFF7E6] px-4 py-3 text-sm text-gray-700">{t('adminCandidateImportProcessingMessage')}</div>
        ) : null}
        {batch.status === 'invalidated' ? (
          <ValidationMessage tone="error">{t('adminCandidateImportInvalidatedMessage')}</ValidationMessage>
        ) : null}
        {batch.status === 'failed' ? (
          <div>
            <ValidationMessage tone="error">{t('adminCandidateImportFailedMessage')}</ValidationMessage>
            <div className="mt-3">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={retry.retry}
                loading={retry.mutation.isPending}
                disabled={retry.mutation.isPending}
              >
                {retry.mutation.isPending ? t('adminCandidateImportRetrying') : t('adminCandidateImportRetryAction')}
              </Button>
              {retry.mutation.isError ? (
                <div className="mt-2">
                  <ValidationMessage tone="error">
                    {retry.mutation.error.message ?? t(CANDIDATE_IMPORT_ERROR_KEYS[retry.mutation.error.code])}
                  </ValidationMessage>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {batch.status === 'completed' || batch.status === 'partial' ? (
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">
              {t('adminCandidateImportTotalRowsLabel')}: {batch.totalRows}
            </Badge>
            <Badge tone="success">
              {t('adminCandidateImportSuccessfulRowsLabel')}: {batch.importedRows}
            </Badge>
            <Badge tone="warning">
              {t('adminCandidateImportRejectedRowsLabel')}: {batch.rejectedRows}
            </Badge>
            <Badge tone="warning">
              {t('adminCandidateImportSkippedRowsLabel')}: {batch.skippedRows}
            </Badge>
          </div>
        ) : null}

        {hasErrorsToDownload ? (
          <div className="mt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => errorExport.mutate()}
              loading={errorExport.isPending}
              disabled={errorExport.isPending}
            >
              {errorExport.isPending ? t('adminCandidateImportDownloadingErrors') : t('adminCandidateImportDownloadErrors')}
            </Button>
            {errorExport.isError ? (
              <div className="mt-2">
                <ValidationMessage tone="error">{errorExport.error.message ?? t('adminCandidateImportErrorExportError')}</ValidationMessage>
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>

      <Card>
        <ImportRowResultsTable rowResults={batch.rowResults} t={t} />
      </Card>

      <Link to="/admin/candidates/import" className="inline-block text-sm font-medium text-brand hover:underline">
        {t('adminCandidateImportBackToImport')}
      </Link>
    </div>
  );
}

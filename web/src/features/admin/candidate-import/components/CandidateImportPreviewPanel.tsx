import { useLanguage } from '../../../../contexts/LanguageContext';
import { Badge, Button, Card, ErrorState, ForbiddenState, OfflineState, ValidationMessage } from '../../../../design-system';
import { CANDIDATE_IMPORT_ERROR_KEYS } from '../../../../../../shared/adminCandidateImport/errorMessages';
import { formatDate } from '../../../../../../shared/i18n/locale';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import type { CandidateImportError, CandidateImportPreflightResult } from '../../../../lib/candidate-import-client';
import { ImportRowErrorsTable } from './ImportRowErrorsTable';

export interface CandidateImportPreviewPanelProps {
  preflight: CandidateImportPreflightResult;
  isCommitting: boolean;
  commitError: CandidateImportError | null;
  onConfirm: () => void;
  onRetryCommit: () => void;
  onStartOverAfterExpiry: () => void;
  onStartOver: () => void;
}

/**
 * The preflight preview: what would happen if this file were imported,
 * before anything is actually persisted (MPS-306/307's preflight endpoint).
 * `acceptedRows === 0` means there is nothing to confirm -- the confirm
 * action is hidden rather than disabled, since there is no valid action to
 * retry into.
 */
export function CandidateImportPreviewPanel({
  preflight,
  isCommitting,
  commitError,
  onConfirm,
  onRetryCommit,
  onStartOverAfterExpiry,
  onStartOver,
}: CandidateImportPreviewPanelProps) {
  const { t, language } = useLanguage();
  const hasAcceptedRows = preflight.acceptedRows > 0;

  const counts: Array<{ labelKey: TranslationKey; value: number; tone: 'neutral' | 'success' | 'warning' | 'danger' }> = [
    { labelKey: 'adminCandidateImportTotalRowsLabel', value: preflight.totalRows, tone: 'neutral' },
    { labelKey: 'adminCandidateImportAcceptedRowsLabel', value: preflight.acceptedRows, tone: 'success' },
    { labelKey: 'adminCandidateImportRejectedRowsLabel', value: preflight.rejectedRows, tone: 'warning' },
  ];

  return (
    <Card className="mb-5" role="status">
      <h2 className="mb-1 text-lg font-semibold text-text-primary">{t('adminCandidateImportPreviewTitle')}</h2>
      <p className="mb-4 text-sm text-text-secondary">
        {hasAcceptedRows ? t('adminCandidateImportPreviewDescription') : t('adminCandidateImportEmptyResultDescription')}
      </p>

      <div className="mb-2 flex flex-wrap gap-2">
        {counts.map((count) => (
          <Badge key={count.labelKey} tone={count.tone}>
            {t(count.labelKey)}: {count.value}
          </Badge>
        ))}
      </div>

      <p className="mb-4 text-xs text-text-tertiary">
        {t('adminCandidateImportPreviewExpiresLabel')}:{' '}
        <span dir="ltr">{formatDate(preflight.expiresAt, language, { dateStyle: 'medium', timeStyle: 'short' })}</span>
      </p>

      <ImportRowErrorsTable errors={preflight.errors} t={t} />

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {hasAcceptedRows ? (
          <Button type="button" variant="primary" onClick={onConfirm} loading={isCommitting} disabled={isCommitting}>
            {t('adminCandidateImportConfirmImport')}
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={onStartOver} disabled={isCommitting}>
          {t('adminCandidateImportSelectAnotherFile')}
        </Button>
      </div>

      {commitError ? <CommitErrorPanel error={commitError} t={t} onRetry={onRetryCommit} onStartOver={onStartOverAfterExpiry} /> : null}
    </Card>
  );
}

function CommitErrorPanel({
  error,
  t,
  onRetry,
  onStartOver,
}: {
  error: CandidateImportError;
  t: (key: TranslationKey) => string;
  onRetry: () => void;
  onStartOver: () => void;
}) {
  if (error.code === 'SESSION_EXPIRED' || error.code === 'INACTIVE_ACCOUNT') {
    // The form's own effect signs the candidate manager out and hands off
    // to RequireStaffAuth's redirect -- nothing to render here.
    return null;
  }

  if (error.code === 'FORBIDDEN') {
    return (
      <div className="mt-4">
        <ForbiddenState title={t('dsForbiddenTitle')} description={t('dsForbiddenDescription')} />
      </div>
    );
  }

  if (error.code === 'OFFLINE') {
    return (
      <div className="mt-4">
        <OfflineState title={t('dsOfflineTitle')} description={t('dsOfflineDescription')} retryLabel={t('retry')} onRetry={onRetry} />
      </div>
    );
  }

  // A stale/expired/invalidated preflight token can never be committed by
  // retrying the same request -- only re-running preflight can recover, so
  // this offers "start over" (keeping the selected file) instead of Retry.
  if (error.code === 'PREFLIGHT_EXPIRED') {
    return (
      <div className="mt-4">
        <ValidationMessage tone="error">{error.message ?? t(CANDIDATE_IMPORT_ERROR_KEYS.PREFLIGHT_EXPIRED)}</ValidationMessage>
        <Button type="button" variant="text" size="sm" onClick={onStartOver}>
          {t('adminCandidateImportRevalidateFile')}
        </Button>
      </div>
    );
  }

  const key = CANDIDATE_IMPORT_ERROR_KEYS[error.code] as TranslationKey;
  const message = error.message ?? t(key);
  return (
    <div className="mt-4">
      <ErrorState message={message} retryLabel={t('retry')} onRetry={onRetry} />
    </div>
  );
}

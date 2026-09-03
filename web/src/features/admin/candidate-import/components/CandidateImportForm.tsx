import { useEffect } from 'react';
import { Link } from 'react-router';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import { Button, Card, ErrorState, ForbiddenState, LoadingState, OfflineState, ValidationMessage } from '../../../../design-system';
import { CANDIDATE_IMPORT_ERROR_KEYS } from '../../../../../../shared/adminCandidateImport/errorMessages';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import type { CandidateImportError } from '../../../../lib/candidate-import-client';
import { useCandidateImportWizard } from '../hooks/useCandidateImportWizard';
import { useCsvTemplateDownload } from '../hooks/useCsvTemplateDownload';
import { REQUIRED_HEADERS } from '../schemas/csvFile';
import { CsvFileField } from './CsvFileField';
import { CandidateImportPreviewPanel } from './CandidateImportPreviewPanel';

const FILE_VALIDATION_ERROR_KEYS: Record<string, TranslationKey> = {
  FILE_REQUIRED: 'adminCandidateImportFileRequiredError',
  INVALID_TYPE: 'adminCandidateImportInvalidFileTypeError',
  FILE_TOO_LARGE: 'adminCandidateImportFileTooLargeError',
};

/** The full admin candidate-import screen: template download, file picker, preflight preview, confirm-to-commit, and every required result/error state (MPS-F304 Phase A). */
export function CandidateImportForm() {
  const { t } = useLanguage();
  const { signOut } = useStaffAuth();
  const wizard = useCandidateImportWizard();
  const templateDownload = useCsvTemplateDownload();

  // A session that authenticatedDataRequest has confirmed is truly dead
  // (refresh already failed) -- end it locally so RequireStaffAuth's
  // existing redirect-to-login takes over, rather than leaving the staff
  // member stuck on a screen whose every retry will keep failing the same
  // way. An INACTIVE_ACCOUNT 403 gets the same treatment: the backend
  // deactivated this staff member's account, so their local session and
  // refresh token must not keep working even though the token itself is
  // still technically valid. Watches both mutations -- either the preflight
  // or the commit call can be the one that discovers this.
  useEffect(() => {
    const code = wizard.preflightMutation.error?.code ?? wizard.commitMutation.error?.code;
    if (code === 'SESSION_EXPIRED') {
      signOut('expired');
    } else if (code === 'INACTIVE_ACCOUNT') {
      signOut('manual');
    }
  }, [wizard.preflightMutation.error, wizard.commitMutation.error, signOut]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">{t('adminCandidateImportTitle')}</h1>
          <p className="text-sm text-text-secondary">{t('adminCandidateImportSubtitle')}</p>
        </div>
        <Link to="/admin/candidates/import/history" className="text-sm font-medium text-brand hover:underline">
          {t('adminCandidateImportViewHistory')}
        </Link>
      </div>

      <Card className="mb-5">
        <h2 className="mb-2 text-base font-semibold text-text-primary">{t('adminCandidateImportInstructionsTitle')}</h2>
        <p className="mb-4 text-sm text-text-secondary">{t('adminCandidateImportInstructionsDescription')}</p>
        <h3 className="mb-1 text-sm font-semibold text-text-primary">{t('adminCandidateImportRequiredHeadersTitle')}</h3>
        <p className="mb-1 break-words font-mono text-xs text-text-secondary">{REQUIRED_HEADERS.join(', ')}</p>
        <p className="mb-4 text-xs text-text-tertiary">{t('adminCandidateImportOptionalHeadersDescription')}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => templateDownload.mutate()}
          loading={templateDownload.isPending}
          disabled={templateDownload.isPending}
        >
          {templateDownload.isPending ? t('adminCandidateImportDownloadingTemplate') : t('adminCandidateImportDownloadTemplate')}
        </Button>
        {templateDownload.isError ? (
          <div className="mt-2">
            <ValidationMessage tone="error">
              {templateDownload.error.message ?? t('adminCandidateImportTemplateDownloadError')}
            </ValidationMessage>
          </div>
        ) : null}
      </Card>

      {wizard.step === 'select' ? (
        <>
          <Card className="mb-5">
            <CsvFileField
              file={wizard.file}
              error={wizard.validationError}
              onSelect={wizard.selectFile}
              disabled={wizard.preflightMutation.isPending}
              labelText={t('adminCandidateImportFileFieldLabel')}
              helperText={t('adminCandidateImportInstructionsDescription')}
              chooseFileLabel={t('adminCandidateImportChooseFile')}
              noFileChosenLabel={t('adminCandidateImportNoFileChosen')}
              selectedFilePrefix={t('adminCandidateImportSelectedFilePrefix')}
              removeFileLabel={t('adminCandidateImportRemoveFile')}
              errorMessages={{
                FILE_REQUIRED: t(FILE_VALIDATION_ERROR_KEYS.FILE_REQUIRED),
                INVALID_TYPE: t(FILE_VALIDATION_ERROR_KEYS.INVALID_TYPE),
                FILE_TOO_LARGE: t(FILE_VALIDATION_ERROR_KEYS.FILE_TOO_LARGE),
              }}
            />

            <div className="mt-4">
              <Button
                type="button"
                variant="primary"
                onClick={wizard.submitPreflight}
                loading={wizard.preflightMutation.isPending}
                disabled={wizard.preflightMutation.isPending}
              >
                {t('adminCandidateImportSubmit')}
              </Button>
            </div>
          </Card>

          {wizard.preflightMutation.isPending ? <LoadingState message={t('adminCandidateImportUploading')} /> : null}

          {wizard.preflightMutation.isError ? (
            <PreflightErrorPanel error={wizard.preflightMutation.error} t={t} onRetry={wizard.retryPreflight} />
          ) : null}
        </>
      ) : null}

      {wizard.step === 'preview' && wizard.preflightMutation.data ? (
        <CandidateImportPreviewPanel
          preflight={wizard.preflightMutation.data}
          isCommitting={wizard.commitMutation.isPending}
          commitError={wizard.commitMutation.error}
          onConfirm={wizard.confirmCommit}
          onRetryCommit={wizard.retryCommit}
          onStartOverAfterExpiry={wizard.startOverAfterExpiry}
          onStartOver={wizard.startOver}
        />
      ) : null}

      {wizard.step === 'submitted' && wizard.commitMutation.data ? (
        <Card role="status">
          <h2 className="mb-2 text-lg font-semibold text-text-primary">{t('adminCandidateImportSubmittedTitle')}</h2>
          <p className="mb-4 text-sm text-text-secondary">{t('adminCandidateImportSubmittedDescription')}</p>
          <div className="flex flex-wrap gap-3">
            <Link
              to={`/admin/candidates/import/${wizard.commitMutation.data.importId}`}
              className="inline-flex h-10 items-center rounded-xl bg-brand px-4 text-sm font-medium text-white hover:bg-brand/90"
            >
              {t('adminCandidateImportViewDetails')}
            </Link>
            <Button type="button" variant="outline" onClick={wizard.startOver}>
              {t('adminCandidateImportSelectAnotherFile')}
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function PreflightErrorPanel({
  error,
  t,
  onRetry,
}: {
  error: CandidateImportError;
  t: (key: TranslationKey) => string;
  onRetry: () => void;
}) {
  if (error.code === 'SESSION_EXPIRED' || error.code === 'INACTIVE_ACCOUNT') {
    // signOut() (triggered above) hands off to RequireStaffAuth's own
    // redirect on the next render -- nothing to render here in the meantime.
    return null;
  }

  if (error.code === 'FORBIDDEN') {
    return <ForbiddenState title={t('dsForbiddenTitle')} description={t('dsForbiddenDescription')} />;
  }

  if (error.code === 'OFFLINE') {
    return (
      <OfflineState title={t('dsOfflineTitle')} description={t('dsOfflineDescription')} retryLabel={t('retry')} onRetry={onRetry} />
    );
  }

  if (error.code === 'INVALID_FILE') {
    return <ValidationMessage tone="error">{error.message ?? t(CANDIDATE_IMPORT_ERROR_KEYS.INVALID_FILE)}</ValidationMessage>;
  }

  const key = CANDIDATE_IMPORT_ERROR_KEYS[error.code] as TranslationKey;
  const message = error.message ?? t(key);
  return <ErrorState message={message} retryLabel={t('retry')} onRetry={onRetry} />;
}

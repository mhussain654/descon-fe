import { useEffect } from 'react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import {
  Button,
  Card,
  ErrorState,
  ForbiddenState,
  LoadingState,
  OfflineState,
  ValidationMessage,
} from '../../../../design-system';
import { CANDIDATE_IMPORT_ERROR_KEYS } from '../../../../../../shared/adminCandidateImport/errorMessages';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import { useCandidateImport } from '../hooks/useCandidateImport';
import { buildCsvTemplate, REQUIRED_HEADERS } from '../schemas/csvFile';
import { CsvFileField } from './CsvFileField';
import { CandidateImportResultView } from './CandidateImportResultView';

const FILE_VALIDATION_ERROR_KEYS: Record<string, TranslationKey> = {
  FILE_REQUIRED: 'adminCandidateImportFileRequiredError',
  INVALID_TYPE: 'adminCandidateImportInvalidFileTypeError',
  FILE_TOO_LARGE: 'adminCandidateImportFileTooLargeError',
};

function downloadCsvTemplate() {
  const blob = new Blob([buildCsvTemplate()], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'candidate-import-template.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** The full admin candidate-import screen content: instructions, file picker, submit, and every required result/error state. */
export function CandidateImportForm() {
  const { t } = useLanguage();
  const { signOut } = useStaffAuth();
  const { file, validationError, selectFile, submit, retry, mutation } = useCandidateImport();

  // A session that authenticatedDataRequest has confirmed is truly dead
  // (refresh already failed) -- end it locally so RequireStaffAuth's
  // existing redirect-to-login takes over, rather than leaving the staff
  // member stuck on a screen whose every retry will keep failing the same
  // way. An INACTIVE_ACCOUNT 403 gets the same treatment: the backend
  // deactivated this staff member's account, so their local session and
  // refresh token must not keep working even though the token itself is
  // still technically valid -- ending the session here is what actually
  // revokes access, not merely showing a permission message. `signOut`
  // reuses 'manual' rather than 'expired' since the account was
  // deactivated, not merely timed out -- the login page's "session
  // expired" toast would otherwise misdescribe why they were signed out.
  useEffect(() => {
    if (mutation.error?.code === 'SESSION_EXPIRED') {
      signOut('expired');
    } else if (mutation.error?.code === 'INACTIVE_ACCOUNT') {
      signOut('manual');
    }
  }, [mutation.error, signOut]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">{t('adminCandidateImportTitle')}</h1>
        <p className="text-sm text-text-secondary">{t('adminCandidateImportSubtitle')}</p>
      </div>

      <Card className="mb-5">
        <h2 className="mb-2 text-base font-semibold text-text-primary">{t('adminCandidateImportInstructionsTitle')}</h2>
        <p className="mb-4 text-sm text-text-secondary">{t('adminCandidateImportInstructionsDescription')}</p>
        <h3 className="mb-1 text-sm font-semibold text-text-primary">{t('adminCandidateImportRequiredHeadersTitle')}</h3>
        <p className="mb-4 break-words font-mono text-xs text-text-secondary">{REQUIRED_HEADERS.join(', ')}</p>
        <Button type="button" variant="outline" size="sm" onClick={downloadCsvTemplate}>
          {t('adminCandidateImportDownloadTemplate')}
        </Button>
      </Card>

      <Card className="mb-5">
        <CsvFileField
          file={file}
          error={validationError}
          onSelect={selectFile}
          disabled={mutation.isPending}
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
          <Button type="button" variant="primary" onClick={submit} loading={mutation.isPending} disabled={mutation.isPending}>
            {t('adminCandidateImportSubmit')}
          </Button>
        </div>
      </Card>

      {mutation.isPending ? <LoadingState message={t('adminCandidateImportUploading')} /> : null}

      {mutation.isError ? <CandidateImportErrorPanel error={mutation.error} t={t} onRetry={retry} /> : null}

      {mutation.isSuccess ? (
        <>
          <CandidateImportResultView result={mutation.data} t={t} />
          <Button type="button" variant="outline" onClick={() => selectFile(null)}>
            {t('adminCandidateImportSelectAnotherFile')}
          </Button>
        </>
      ) : null}
    </div>
  );
}

function CandidateImportErrorPanel({
  error,
  t,
  onRetry,
}: {
  error: NonNullable<ReturnType<typeof useCandidateImport>['mutation']['error']>;
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
    return (
      <ValidationMessage tone="error">{error.message ?? t(CANDIDATE_IMPORT_ERROR_KEYS.INVALID_FILE)}</ValidationMessage>
    );
  }

  const key = CANDIDATE_IMPORT_ERROR_KEYS[error.code] as TranslationKey;
  const message = error.message ?? t(key);
  return <ErrorState message={message} retryLabel={t('retry')} onRetry={onRetry} />;
}

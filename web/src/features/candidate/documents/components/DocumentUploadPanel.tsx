import { useId, useRef } from 'react';
import {
  Button,
  ErrorState,
  HelperText,
  Label,
  LoadingState,
  OfflineState,
  ValidationMessage,
} from '../../../../design-system';
import { CANDIDATE_DOCUMENTS_ERROR_KEYS } from '../../../../../../shared/candidateDocuments/errorMessages';
import type { FileValidationError } from '../../../../../../shared/candidateDocuments/fileValidation';
import type { CandidateDocumentsError } from '../../../../lib/candidate-documents-client';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';

const FILE_VALIDATION_ERROR_KEYS: Record<FileValidationError, TranslationKey> = {
  FILE_REQUIRED: 'candidateDocumentsFileRequiredError',
  EMPTY_FILE: 'candidateDocumentsEmptyFileError',
  FILE_TOO_LARGE: 'candidateDocumentsFileTooLargeError',
  INVALID_TYPE: 'candidateDocumentsInvalidFileTypeError',
};

export interface DocumentUploadPanelProps {
  labelText: string;
  file: File | null;
  validationError: FileValidationError | null;
  uploadError: CandidateDocumentsError | null;
  isUploading: boolean;
  onSelect: (file: File | null) => void;
  onCancel: () => void;
  onSubmit: () => void;
  t: (key: TranslationKey) => string;
}

/**
 * Inline upload/replace panel for one checklist requirement. Never builds a
 * blob URL for the selected file -- ticket: "Preview is not required", and
 * the filename/size shown below come straight off the `File` object, no
 * object URL needed at all.
 */
export function DocumentUploadPanel({
  labelText,
  file,
  validationError,
  uploadError,
  isUploading,
  onSelect,
  onCancel,
  onSubmit,
  t,
}: DocumentUploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fieldId = useId();
  const helperId = `${fieldId}-helper`;
  const errorId = `${fieldId}-error`;

  if (isUploading) {
    return <LoadingState message={t('candidateDocumentsUploading')} />;
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-surface-sunken p-4">
      <Label htmlFor={fieldId}>{labelText}</Label>
      <input
        ref={inputRef}
        id={fieldId}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        className="sr-only"
        aria-describedby={validationError ? `${helperId} ${errorId}` : helperId}
        aria-invalid={validationError ? true : undefined}
        onChange={(event) => onSelect(event.currentTarget.files?.[0] ?? null)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          {t('candidateDocumentsChooseFile')}
        </Button>
        <span className="text-sm text-text-secondary">
          {file ? `${t('candidateDocumentsSelectedFilePrefix')}: ${file.name}` : t('candidateDocumentsNoFileChosen')}
        </span>
      </div>
      <HelperText id={helperId}>{t('candidateDocumentsFileFieldHelper')}</HelperText>
      {validationError ? (
        <ValidationMessage id={errorId} tone="error">
          {t(FILE_VALIDATION_ERROR_KEYS[validationError])}
        </ValidationMessage>
      ) : null}

      {uploadError ? <DocumentUploadErrorNotice error={uploadError} t={t} /> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="primary" size="sm" onClick={onSubmit} disabled={!file || !!validationError}>
          {uploadError ? t('retry') : t('candidateDocumentsSubmitUpload')}
        </Button>
        <Button type="button" variant="text" size="sm" onClick={onCancel}>
          {t('candidateDocumentsCancel')}
        </Button>
      </div>
    </div>
  );
}

function DocumentUploadErrorNotice({ error, t }: { error: CandidateDocumentsError; t: (key: TranslationKey) => string }) {
  if (error.code === 'SESSION_EXPIRED' || error.code === 'INACTIVE_ACCOUNT') {
    // The parent checklist view signs the candidate out and replaces the
    // whole screen for these -- nothing to render here in the meantime.
    return null;
  }

  if (error.code === 'OFFLINE') {
    return (
      <div className="mt-3">
        <OfflineState title={t('dsOfflineTitle')} description={t('dsOfflineDescription')} />
      </div>
    );
  }

  const key = CANDIDATE_DOCUMENTS_ERROR_KEYS[error.code] as TranslationKey;
  const message = error.message ?? t(key);
  return (
    <div className="mt-3">
      <ErrorState message={message} />
    </div>
  );
}

import { useEffect, useId, useRef, useState } from 'react';
import {
  Button,
  ErrorState,
  HelperText,
  Input,
  Label,
  LoadingState,
  OfflineState,
  ValidationMessage,
} from '../../../../design-system';
import { CANDIDATE_DOCUMENTS_ERROR_KEYS } from '../../../../../../shared/candidateDocuments/errorMessages';
import { describeFileType, isPreviewableImageType } from '../../../../../../shared/candidateDocuments/fileDescription';
import type { FileValidationError } from '../../../../../../shared/candidateDocuments/fileValidation';
import { formatFileSize } from '../../../../../../shared/candidateDocuments/formatting';
import type { PccIssueDateError } from '../../../../../../shared/candidateDocuments/pccIssueDate';
import type { CandidateDocumentsError } from '../../../../lib/candidate-documents-client';
import type { Language, TranslationKey } from '../../../../../../shared/i18n/translations';

const FILE_VALIDATION_ERROR_KEYS: Record<FileValidationError, TranslationKey> = {
  FILE_REQUIRED: 'candidateDocumentsFileRequiredError',
  EMPTY_FILE: 'candidateDocumentsEmptyFileError',
  FILE_TOO_LARGE: 'candidateDocumentsFileTooLargeError',
  INVALID_TYPE: 'candidateDocumentsInvalidFileTypeError',
};

const PCC_ISSUE_DATE_ERROR_KEYS: Record<PccIssueDateError, TranslationKey> = {
  REQUIRED: 'candidateDocumentsPccIssueDateRequiredError',
  INVALID_FORMAT: 'candidateDocumentsPccIssueDateInvalidError',
  IN_FUTURE: 'candidateDocumentsPccIssueDateInFutureError',
};

export interface DocumentUploadPanelProps {
  labelText: string;
  file: File | null;
  validationError: FileValidationError | null;
  uploadError: CandidateDocumentsError | null;
  isUploading: boolean;
  isPccRequirement: boolean;
  issuedOn: string;
  onIssuedOnChange: (value: string) => void;
  issuedOnError: PccIssueDateError | null;
  onSelect: (file: File | null) => void;
  onCancel: () => void;
  onSubmit: () => void;
  t: (key: TranslationKey) => string;
  language: Language;
}

/**
 * Inline upload/replace panel for one checklist requirement. Builds a local
 * object URL to preview the selected file only when it's an image (a PDF
 * has no safe inline preview here) -- always revoked below when the file
 * changes or the panel unmounts, so a stale blob URL is never left pointing
 * at memory the browser can't reclaim.
 */
export function DocumentUploadPanel({
  labelText,
  file,
  validationError,
  uploadError,
  isUploading,
  isPccRequirement,
  issuedOn,
  onIssuedOnChange,
  issuedOnError,
  onSelect,
  onCancel,
  onSubmit,
  t,
  language,
}: DocumentUploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fieldId = useId();
  const helperId = `${fieldId}-helper`;
  const errorId = `${fieldId}-error`;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file || !isPreviewableImageType({ name: file.name, size: file.size, type: file.type })) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (isUploading) {
    return <LoadingState message={t('candidateDocumentsUploading')} />;
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-surface-sunken p-4">
      <Label htmlFor={fieldId}>{labelText}</Label>
      {isPccRequirement ? (
        <div className="mb-3">
          <Input
            label={t('candidateDocumentsPccIssueDateFieldLabel')}
            helperText={issuedOnError ? undefined : t('candidateDocumentsPccIssueDateFieldHelper')}
            errorMessage={issuedOnError ? t(PCC_ISSUE_DATE_ERROR_KEYS[issuedOnError]) : undefined}
            value={issuedOn}
            onChange={(event) => onIssuedOnChange(event.currentTarget.value)}
            placeholder="YYYY-MM-DD"
            inputMode="numeric"
          />
        </div>
      ) : null}
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
          {file
            ? `${t('candidateDocumentsSelectedFilePrefix')}: ${file.name} • ${describeFileType({ name: file.name, size: file.size, type: file.type })} • ${formatFileSize(file.size, language)}`
            : t('candidateDocumentsNoFileChosen')}
        </span>
      </div>
      {previewUrl ? (
        <img
          src={previewUrl}
          alt={file?.name ?? ''}
          className="mt-2 h-24 w-24 rounded-lg border border-border object-cover"
        />
      ) : null}
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

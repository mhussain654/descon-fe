import { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  Button,
  ErrorState,
  FilterChip,
  HelperText,
  IconButton,
  Input,
  Label,
  LoadingState,
  OfflineState,
  ValidationMessage,
} from '../../../../design-system';
import { CANDIDATE_DOCUMENTS_ERROR_KEYS } from '../../../../../../shared/candidateDocuments/errorMessages';
import { describeFileType, isPreviewableImageType } from '../../../../../../shared/candidateDocuments/fileDescription';
import {
  FILE_SET_REASON_KEYS,
  SIDE_CODE_LABEL_KEYS,
  slotFile,
  type FileSetValidationError,
} from '../../../../../../shared/candidateDocuments/fileSet';
import { formatFileSize } from '../../../../../../shared/candidateDocuments/formatting';
import type { PccIssueDateError } from '../../../../../../shared/candidateDocuments/pccIssueDate';
import type { DocumentSideCode } from '../../../../../../shared/candidateDocuments/types';
import { interpolate } from '../../../../../../shared/i18n/interpolate';
import type { CandidateDocumentsError } from '../../../../lib/candidate-documents-client';
import type { Language, TranslationKey } from '../../../../../../shared/i18n/translations';
import type { DocumentUploadController } from '../hooks/useDocumentUpload';

const FILE_ERROR_KEYS: Record<'EMPTY_FILE' | 'FILE_TOO_LARGE' | 'INVALID_TYPE', TranslationKey> = {
  EMPTY_FILE: 'candidateDocumentsEmptyFileError',
  FILE_TOO_LARGE: 'candidateDocumentsFileTooLargeError',
  INVALID_TYPE: 'candidateDocumentsInvalidFileTypeError',
};

const PCC_ISSUE_DATE_ERROR_KEYS: Record<PccIssueDateError, TranslationKey> = {
  REQUIRED: 'candidateDocumentsPccIssueDateRequiredError',
  INVALID_FORMAT: 'candidateDocumentsPccIssueDateInvalidError',
  IN_FUTURE: 'candidateDocumentsPccIssueDateInFutureError',
};

type Translate = (key: TranslationKey) => string;

export interface DocumentUploadPanelProps {
  labelText: string;
  /** Backend-provided, already localized. */
  instructions: string | null;
  upload: DocumentUploadController;
  t: Translate;
  language: Language;
}

/**
 * Inline upload/replace panel for one checklist requirement, shaped entirely
 * by the requirement's backend upload rules: one file, a pair of parts
 * (front/back or page 1/page 2) -- optionally one combined PDF instead --
 * or several files (e.g. certificates).
 */
export function DocumentUploadPanel({ labelText, instructions, upload, t, language }: DocumentUploadPanelProps) {
  const { layout, rules, entries, validation, showSetError, mutation } = upload;
  if (!layout || !rules) return null;

  if (mutation.isPending) {
    return <LoadingState message={t('candidateDocumentsUploading')} />;
  }

  const accept = rules.acceptedContentTypes.join(',');
  const fileErrorFor = (file: File | null) => {
    if (!file || validation?.kind !== 'file' || entries[validation.index]?.file !== file) return null;
    return t(FILE_ERROR_KEYS[validation.code]);
  };
  const slot = (sideCode: DocumentSideCode | null, label: string, slotAccept = accept) => (
    <FileSlot
      key={sideCode ?? 'single'}
      label={label}
      accept={slotAccept}
      file={slotFile(entries, sideCode)}
      error={fileErrorFor(slotFile(entries, sideCode))}
      onSelect={(file) => upload.selectSlotFile(sideCode, file)}
      t={t}
      language={language}
    />
  );

  return (
    <div className="mt-3 rounded-xl border border-border bg-surface-sunken p-4">
      <Label>{labelText}</Label>
      {instructions ? <p className="mb-3 text-sm text-text-secondary">{instructions}</p> : null}

      {upload.isPccRequirement ? (
        <div className="mb-3">
          <Input
            label={t('candidateDocumentsPccIssueDateFieldLabel')}
            helperText={upload.issuedOnError ? undefined : t('candidateDocumentsPccIssueDateFieldHelper')}
            errorMessage={upload.issuedOnError ? t(PCC_ISSUE_DATE_ERROR_KEYS[upload.issuedOnError]) : undefined}
            value={upload.issuedOn}
            onChange={(event) => upload.setIssuedOn(event.currentTarget.value)}
            placeholder="YYYY-MM-DD"
            inputMode="numeric"
          />
        </div>
      ) : null}

      {layout.kind === 'single' ? slot(null, t('candidateDocumentsChooseFile')) : null}

      {layout.kind === 'pair' ? (
        <>
          {layout.combinedAllowed ? (
            <div role="group" aria-label={t('candidateDocumentsUploadModeLabel')} className="mb-3 flex flex-wrap gap-2">
              <FilterChip selected={upload.mode === 'parts'} onClick={() => upload.setMode('parts')}>
                {t('candidateDocumentsUploadModeParts')}
              </FilterChip>
              <FilterChip selected={upload.mode === 'combined'} onClick={() => upload.setMode('combined')}>
                {t('candidateDocumentsUploadModeCombined')}
              </FilterChip>
            </div>
          ) : null}
          {upload.mode === 'combined' && layout.combinedAllowed
            ? slot('combined', t(SIDE_CODE_LABEL_KEYS.combined as TranslationKey), 'application/pdf')
            : layout.parts.map((part) => slot(part, t(SIDE_CODE_LABEL_KEYS[part] as TranslationKey)))}
        </>
      ) : null}

      {layout.kind === 'multiple' ? (
        <MultipleFiles
          maximumFiles={layout.maximumFiles}
          accept={accept}
          upload={upload}
          fileErrorFor={fileErrorFor}
          t={t}
          language={language}
        />
      ) : null}

      <HelperText>{t('candidateDocumentsFileFieldHelper')}</HelperText>
      {showSetError && validation?.kind === 'set' ? (
        <ValidationMessage tone="error">{t(FILE_SET_REASON_KEYS[validation.reason] as TranslationKey)}</ValidationMessage>
      ) : null}

      {mutation.error ? <DocumentUploadErrorNotice error={mutation.error} t={t} /> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={upload.submit}
          disabled={entries.length === 0 || validation?.kind === 'file'}
        >
          {mutation.error ? t('retry') : t('candidateDocumentsSubmitUpload')}
        </Button>
        <Button type="button" variant="text" size="sm" onClick={upload.cancelUpload}>
          {t('candidateDocumentsCancel')}
        </Button>
      </div>
    </div>
  );
}

interface FileSlotProps {
  label: string;
  accept: string;
  file: File | null;
  error: string | null;
  onSelect: (file: File | null) => void;
  t: Translate;
  language: Language;
}

/** One labelled file slot: pick a file, see what was picked (with an image thumbnail), or remove it. */
function FileSlot({ label, accept, file, error, onSelect, t, language }: FileSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fieldId = useId();
  const errorId = `${fieldId}-error`;

  return (
    <div className="mb-3">
      <span className="mb-1 block text-sm font-medium text-text-primary" id={`${fieldId}-label`}>
        {label}
      </span>
      <input
        ref={inputRef}
        id={fieldId}
        type="file"
        accept={accept}
        className="sr-only"
        aria-labelledby={`${fieldId}-label`}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        onChange={(event) => {
          onSelect(event.currentTarget.files?.[0] ?? null);
          event.currentTarget.value = '';
        }}
      />
      {file ? (
        <SelectedFile file={file} onRemove={() => onSelect(null)} t={t} language={language} />
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            {t('candidateDocumentsChooseFile')}
          </Button>
          <span className="text-sm text-text-tertiary">{t('candidateDocumentsNoFileChosen')}</span>
        </div>
      )}
      {error ? (
        <ValidationMessage id={errorId} tone="error">
          {error}
        </ValidationMessage>
      ) : null}
    </div>
  );
}

interface MultipleFilesProps {
  maximumFiles: number;
  accept: string;
  upload: DocumentUploadController;
  fileErrorFor: (file: File | null) => string | null;
  t: Translate;
  language: Language;
}

/** A growing list of files under one requirement (e.g. several certificates), up to the backend's limit. */
function MultipleFiles({ maximumFiles, accept, upload, fileErrorFor, t, language }: MultipleFilesProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { entries } = upload;
  const canAddMore = entries.length < maximumFiles;

  return (
    <div className="mb-3">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="sr-only"
        aria-label={t('candidateDocumentsAddFile')}
        onChange={(event) => {
          upload.addFiles(Array.from(event.currentTarget.files ?? []));
          event.currentTarget.value = '';
        }}
      />
      {entries.length ? (
        <ul className="mb-2 flex flex-col gap-2" aria-label={t('candidateDocumentsFilesLabel')}>
          {entries.map((entry, index) => (
            <li key={`${entry.file.name}-${entry.file.lastModified}-${index}`}>
              <SelectedFile file={entry.file} onRemove={() => upload.removeFileAt(index)} t={t} language={language} />
              {fileErrorFor(entry.file) ? <ValidationMessage tone="error">{fileErrorFor(entry.file)}</ValidationMessage> : null}
            </li>
          ))}
        </ul>
      ) : null}
      <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={!canAddMore}>
        {t(entries.length ? 'candidateDocumentsAddAnotherFile' : 'candidateDocumentsAddFile')}
      </Button>
      <HelperText>{interpolate(t('candidateDocumentsFileLimitHint'), { count: maximumFiles })}</HelperText>
    </div>
  );
}

/**
 * A chosen file's name, type and size, with a thumbnail for images. The
 * thumbnail's object URL is revoked whenever the file changes or the row
 * unmounts, so no stale blob URL is left behind.
 */
function SelectedFile({ file, onRemove, t, language }: { file: File; onRemove: () => void; t: Translate; language: Language }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isPreviewableImageType({ name: file.name, size: file.size, type: file.type })) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-white p-2">
      {previewUrl ? <img src={previewUrl} alt={file.name} className="h-12 w-12 rounded-md object-cover" /> : null}
      <span className="min-w-0 flex-1 truncate text-sm text-text-secondary">
        {`${t('candidateDocumentsSelectedFilePrefix')}: ${file.name} • ${describeFileType({ name: file.name, size: file.size, type: file.type })} • ${formatFileSize(file.size, language)}`}
      </span>
      <IconButton icon={<X size={16} />} label={t('candidateDocumentsRemoveFile')} variant="ghost" size="sm" onClick={onRemove} />
    </div>
  );
}

function DocumentUploadErrorNotice({ error, t }: { error: CandidateDocumentsError; t: Translate }) {
  if (error.code === 'SESSION_EXPIRED' || error.code === 'INACTIVE_ACCOUNT') {
    // The checklist view signs the candidate out for these.
    return null;
  }

  if (error.code === 'OFFLINE') {
    return (
      <div className="mt-3">
        <OfflineState title={t('dsOfflineTitle')} description={t('dsOfflineDescription')} />
      </div>
    );
  }

  const message =
    error.code === 'INVALID_DOCUMENT_FILES' && error.reason
      ? t(FILE_SET_REASON_KEYS[error.reason] as TranslationKey)
      : (error.message ?? t(CANDIDATE_DOCUMENTS_ERROR_KEYS[error.code] as TranslationKey));
  return (
    <div className="mt-3">
      <ErrorState message={message} />
    </div>
  );
}

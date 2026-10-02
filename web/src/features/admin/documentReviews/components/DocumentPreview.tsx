import { useLanguage } from '../../../../contexts/LanguageContext';
import { Button, Dialog, DialogContent, EmptyState, ErrorState, FilterChip, LoadingState } from '../../../../design-system';
import { SIDE_CODE_LABEL_KEYS } from '../../../../../../shared/candidateDocuments/fileSet';
import { ADMIN_DOCUMENT_REVIEW_ERROR_KEYS } from '../../../../../../shared/adminDocumentReviews/errorMessages';
import type { AdminDocumentReviewError, DocumentAccess, SubmissionDocument } from '../../../../../../shared/adminDocumentReviews/types';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import { resolveDocumentAccessUrl } from '../../../../lib/resolveDocumentAccessUrl';

const PREVIEWABLE_CONTENT_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

export interface DocumentPreviewProps {
  document: SubmissionDocument;
  /** The file being previewed (the document's first file when null). */
  activeFileId: string | null;
  /** Switches the preview to another file of the same document. */
  onSelectFile: (fileId: string) => void;
  access: DocumentAccess | null;
  isRequesting: boolean;
  error: AdminDocumentReviewError | null;
  isExpired: boolean;
  onClose: () => void;
  onRequestNewAccess: () => void;
}

/**
 * Renders the document's short-lived preview credential inline (never as a
 * downloadable/permanent link -- ticket: "Never convert the path into a
 * permanent or public URL. Do not add a general download action."). Access
 * is requested by the caller only once the reviewer opens this dialog, and
 * is cleared by the caller when it closes -- this component never fetches
 * or persists anything on its own.
 */
export function DocumentPreview({
  document,
  activeFileId,
  onSelectFile,
  access,
  isRequesting,
  error,
  isExpired,
  onClose,
  onRequestNewAccess,
}: DocumentPreviewProps) {
  const { t } = useLanguage();
  const activeFile = document.files.find((file) => file.id === activeFileId) ?? document.files[0] ?? null;
  const contentType = activeFile?.contentType ?? document.contentType;
  const fileName = activeFile?.fileName ?? document.fileName;
  const isSupported = PREVIEWABLE_CONTENT_TYPES.has(contentType);
  // Fails closed: resolveDocumentAccessUrl returns null for anything that
  // doesn't resolve to our own API origin (a malformed backend response, an
  // unexpected absolute URL, a dangerous scheme) -- never render that as a
  // preview source.
  const resolvedUrl = access ? resolveDocumentAccessUrl(access.url, import.meta.env.VITE_API_BASE_URL ?? '') : null;

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent title={document.name} closeLabel={t('dsClose')}>
        {document.files.length > 1 ? (
          <div role="group" aria-label={t('adminDocumentReviewFilesLabel')} className="mb-3 flex flex-wrap gap-2">
            {document.files.map((file) => (
              <FilterChip key={file.id} selected={file.id === activeFile?.id} onClick={() => onSelectFile(file.id)}>
                {file.sideCode ? t(SIDE_CODE_LABEL_KEYS[file.sideCode] as TranslationKey) : file.fileName}
              </FilterChip>
            ))}
          </div>
        ) : null}
        {isRequesting ? <LoadingState message={t('loading')} /> : null}

        {!isRequesting && error ? (
          <ErrorState
            message={error.message || t((ADMIN_DOCUMENT_REVIEW_ERROR_KEYS[error.code] as TranslationKey) ?? 'somethingWentWrong')}
            retryLabel={t('retry')}
            onRetry={onRequestNewAccess}
          />
        ) : null}

        {!isRequesting && !error && isExpired ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-text-secondary">{t('adminDocumentReviewPreviewExpiredMessage')}</p>
            <Button onClick={onRequestNewAccess}>{t('adminDocumentReviewRequestNewAccess')}</Button>
          </div>
        ) : null}

        {!isRequesting && !error && !isExpired && access ? (
          !resolvedUrl ? (
            <ErrorState message={t('somethingWentWrong')} retryLabel={t('retry')} onRetry={onRequestNewAccess} />
          ) : isSupported ? (
            contentType === 'application/pdf' ? (
              <embed src={resolvedUrl} type="application/pdf" title={fileName} className="h-[70vh] w-full rounded-lg" />
            ) : (
              <img src={resolvedUrl} alt={fileName} className="max-h-[70vh] w-full rounded-lg object-contain" />
            )
          ) : (
            <EmptyState
              title={t('adminDocumentReviewPreviewUnsupportedTitle')}
              description={t('adminDocumentReviewPreviewUnsupportedDescription')}
            />
          )
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

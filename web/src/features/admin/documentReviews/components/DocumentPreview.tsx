import { useLanguage } from '../../../../contexts/LanguageContext';
import { Button, Dialog, DialogContent, EmptyState, ErrorState, LoadingState } from '../../../../design-system';
import { ADMIN_DOCUMENT_REVIEW_ERROR_KEYS } from '../../../../../../shared/adminDocumentReviews/errorMessages';
import type { AdminDocumentReviewError, DocumentAccess, SubmissionDocument } from '../../../../../../shared/adminDocumentReviews/types';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import { resolveDocumentAccessUrl } from '../../../../lib/resolveDocumentAccessUrl';

const PREVIEWABLE_CONTENT_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

export interface DocumentPreviewProps {
  document: SubmissionDocument;
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
export function DocumentPreview({ document, access, isRequesting, error, isExpired, onClose, onRequestNewAccess }: DocumentPreviewProps) {
  const { t } = useLanguage();
  const isSupported = PREVIEWABLE_CONTENT_TYPES.has(document.contentType);

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent title={document.name} closeLabel={t('dsClose')}>
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
          isSupported ? (
            document.contentType === 'application/pdf' ? (
              <embed
                src={resolveDocumentAccessUrl(access.url, import.meta.env.VITE_API_BASE_URL ?? '')}
                type="application/pdf"
                title={document.name}
                className="h-[70vh] w-full rounded-lg"
              />
            ) : (
              <img
                src={resolveDocumentAccessUrl(access.url, import.meta.env.VITE_API_BASE_URL ?? '')}
                alt={document.name}
                className="max-h-[70vh] w-full rounded-lg object-contain"
              />
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

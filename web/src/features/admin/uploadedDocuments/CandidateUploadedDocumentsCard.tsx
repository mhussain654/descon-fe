import { useMutation, useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, ValidationMessage } from '../../../design-system';
import { adminUploadedDocumentsClient } from '../../../lib/admin-uploaded-documents-client';
import type { UploadedDocument, UploadedDocumentsError } from '../../../lib/admin-uploaded-documents-client';
import { resolveDocumentAccessUrl } from '../../../lib/resolveDocumentAccessUrl';
import { formatFileSize } from '../../../../../shared/candidateDocuments/formatting';
import type { TranslationKey } from '../../../../../shared/i18n/translations';

const STATUS_KEYS: Record<string, TranslationKey> = {
  uploaded: 'adminUploadedDocumentsStatusUploaded',
  under_verification: 'adminUploadedDocumentsStatusUnderVerification',
  verified: 'adminUploadedDocumentsStatusVerified',
  rejected: 'adminUploadedDocumentsStatusRejected',
};

/**
 * Developer-only, view-only list of everything the candidate has uploaded,
 * submitted or not, so support can check what they sent. There is no approve
 * or reject here: that happens in Document reviews once the candidate submits.
 */
export function CandidateUploadedDocumentsCard({ candidateId }: { candidateId: string }) {
  const { t, language } = useLanguage();
  const query = useQuery<UploadedDocument[], UploadedDocumentsError>({
    queryKey: ['adminUploadedDocuments', candidateId, language],
    queryFn: () => adminUploadedDocumentsClient.listUploadedDocuments(candidateId),
  });
  const open = useMutation<string | null, UploadedDocumentsError, { documentId: string; fileId: string }>({
    mutationFn: async ({ documentId, fileId }) => {
      const access = await adminUploadedDocumentsClient.openFile(candidateId, documentId, fileId);
      return resolveDocumentAccessUrl(access.url, import.meta.env.VITE_API_BASE_URL ?? '');
    },
    onSuccess: (url) => {
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    },
  });

  return (
    <Card>
      <h2 className="text-lg font-semibold text-text-primary">{t('adminUploadedDocumentsTitle')}</h2>
      <p className="mb-4 text-sm text-text-secondary">{t('adminUploadedDocumentsDescription')}</p>
      {query.isPending ? <LoadingState message={t('loading')} /> : null}
      {query.isError ? <ErrorState message={query.error.message ?? t('adminUploadedDocumentsError')} retryLabel={t('retry')} onRetry={() => query.refetch()} /> : null}
      {query.data && query.data.length === 0 ? <EmptyState title={t('adminUploadedDocumentsEmpty')} /> : null}
      {query.data && query.data.length > 0 ? (
        <ul className="divide-y divide-border border-t border-border">
          {query.data.map((document) => (
            <li key={document.id} className="py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-text-primary">{document.documentType.name}</span>
                <Badge tone={document.submitted ? 'success' : 'warning'}>
                  {t(document.submitted ? 'adminUploadedDocumentsSubmitted' : 'adminUploadedDocumentsNotSubmitted')}
                </Badge>
                <Badge tone="neutral">{t(STATUS_KEYS[document.status] ?? 'adminUploadedDocumentsStatusUploaded')}</Badge>
              </div>
              <ul className="mt-2 space-y-1">
                {document.files.map((file) => (
                  <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate text-text-secondary" dir="ltr">
                      {file.originalFilename} · {formatFileSize(file.byteSize, language)}
                    </span>
                    <Button
                      type="button"
                      variant="text"
                      size="sm"
                      onClick={() => open.mutate({ documentId: document.id, fileId: file.id })}
                      loading={open.isPending && open.variables?.fileId === file.id}
                      aria-label={`${t('adminUploadedDocumentsView')} ${file.originalFilename}`}
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      {t('adminUploadedDocumentsView')}
                    </Button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : null}
      {open.isError ? (
        <div className="mt-3">
          <ValidationMessage tone="error">{open.error.message ?? t('adminUploadedDocumentsOpenError')}</ValidationMessage>
        </div>
      ) : null}
    </Card>
  );
}

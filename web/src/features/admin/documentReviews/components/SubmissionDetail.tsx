import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
  OfflineState,
  Textarea,
  ValidationMessage,
} from '../../../../design-system';
import { formatDate } from '../../../../../../shared/i18n/locale';
import { ADMIN_DOCUMENT_REVIEW_ERROR_KEYS } from '../../../../../../shared/adminDocumentReviews/errorMessages';
import { formatFileSize } from '../../../../../../shared/adminDocumentReviews/formatting';
import { DOCUMENT_STATUS_KEYS, DOCUMENT_STATUS_TONES } from '../../../../../../shared/adminDocumentReviews/statusLabels';
import type { SubmissionDocument } from '../../../../../../shared/adminDocumentReviews/types';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import { useDocumentAccess } from '../hooks/useDocumentAccess';
import { useDocumentSubmission } from '../hooks/useDocumentSubmission';
import { useReviewDecision } from '../hooks/useReviewDecision';
import { DocumentPreview } from './DocumentPreview';

export interface SubmissionDetailProps {
  submissionId: string;
}

/** The full admin submission-detail screen: safe document metadata, secure preview, and verify/reject actions. */
export function SubmissionDetail({ submissionId }: SubmissionDetailProps) {
  const { t, language } = useLanguage();
  const { signOut } = useStaffAuth();
  const query = useDocumentSubmission(submissionId);
  const decision = useReviewDecision(submissionId);
  const documentAccess = useDocumentAccess();
  const [previewDocumentId, setPreviewDocumentId] = useState<string | null>(null);

  useEffect(() => {
    if (query.error?.code === 'SESSION_EXPIRED') {
      signOut('expired');
    } else if (query.error?.code === 'INACTIVE_ACCOUNT') {
      signOut('manual');
    }
  }, [query.error, signOut]);

  // A still-open preview credential must not survive navigating to a
  // different submission (ticket: "Clear it when the submission changes.").
  useEffect(() => {
    setPreviewDocumentId(null);
    documentAccess.clearAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId]);

  const openPreview = (documentId: string) => {
    setPreviewDocumentId(documentId);
    documentAccess.requestAccess(documentId);
  };

  const closePreview = () => {
    setPreviewDocumentId(null);
    documentAccess.clearAccess();
  };

  if (query.isLoading) {
    return <LoadingState message={t('loading')} />;
  }

  if (query.isError) {
    const error = query.error;
    if (error?.code === 'OFFLINE') {
      return (
        <OfflineState
          title={t('dsOfflineTitle')}
          description={t('dsOfflineDescription')}
          retryLabel={t('retry')}
          onRetry={() => query.refetch()}
        />
      );
    }
    if (error?.code === 'REVIEW_NOT_ALLOWED' || error?.code === 'FORBIDDEN') {
      return <ForbiddenState title={t('dsForbiddenTitle')} description={t('staffAuthForbiddenError')} />;
    }
    if (error?.code === 'SESSION_EXPIRED' || error?.code === 'INACTIVE_ACCOUNT') {
      return null;
    }
    const messageKey = (error ? ADMIN_DOCUMENT_REVIEW_ERROR_KEYS[error.code] : 'somethingWentWrong') as TranslationKey;
    return <ErrorState message={error?.message || t(messageKey)} retryLabel={t('retry')} onRetry={() => query.refetch()} />;
  }

  const detail = query.data;
  if (!detail) return null;

  const previewDocument = detail.documents.find((doc) => doc.id === previewDocumentId) ?? null;
  const decisionError = decision.mutation.error;
  const rejectionFieldError =
    decisionError?.code === 'REJECTION_REASON_REQUIRED' || decisionError?.code === 'REJECTION_REASON_INVALID'
      ? decisionError.message || t(ADMIN_DOCUMENT_REVIEW_ERROR_KEYS[decisionError.code] as TranslationKey)
      : undefined;
  const nonFieldDecisionError =
    decisionError && !rejectionFieldError && decisionError.code !== 'IDEMPOTENCY_CONFLICT'
      ? decisionError.message || t(ADMIN_DOCUMENT_REVIEW_ERROR_KEYS[decisionError.code] as TranslationKey)
      : undefined;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <Link to="/admin/document-reviews" className="text-sm font-medium text-brand hover:underline">
        {t('adminDocumentReviewBackToQueue')}
      </Link>

      <div className="mb-6 mt-2">
        <h1 className="text-2xl font-semibold text-text-primary">{t('adminDocumentReviewDetailTitle')}</h1>
        <p className="text-sm text-text-secondary">{detail.candidate.fullName}</p>
        <p className="text-xs text-text-tertiary">{detail.candidate.id}</p>
      </div>

      <Card className="mb-4">
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-text-tertiary">{t('adminDocumentReviewColumnAssignment')}</dt>
            <dd className="font-medium text-text-primary">{detail.assignment.referenceNumber}</dd>
          </div>
          <div>
            <dt className="text-text-tertiary">{t('adminDocumentReviewColumnProject')}</dt>
            <dd className="font-medium text-text-primary">{detail.assignment.project.name}</dd>
          </div>
          <div>
            <dt className="text-text-tertiary">{t('adminDocumentReviewColumnCountry')}</dt>
            <dd className="font-medium text-text-primary">{detail.assignment.country.name}</dd>
          </div>
          <div>
            <dt className="text-text-tertiary">{t('adminDocumentReviewColumnCraft')}</dt>
            <dd className="font-medium text-text-primary">{detail.assignment.craft.name}</dd>
          </div>
          <div>
            <dt className="text-text-tertiary">{t('adminDocumentReviewColumnSubmitted')}</dt>
            <dd className="font-medium text-text-primary">
              {formatDate(detail.submittedAt, language, { dateStyle: 'medium', timeStyle: 'short' })}
            </dd>
          </div>
        </dl>
      </Card>

      {detail.documents.length === 0 ? (
        <EmptyState title={t('adminDocumentReviewNoDocumentsMessage')} />
      ) : (
        <div className="space-y-4">
          {detail.documents.map((document) => (
            <DocumentRow
              key={document.id}
              document={document}
              onPreview={() => openPreview(document.id)}
              onVerify={() => decision.openVerifyConfirm(document.id)}
              onReject={() => decision.openRejectConfirm(document.id)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={decision.confirmTarget?.action === 'verified'}
        onOpenChange={(open) => (!open ? decision.closeConfirm() : undefined)}
        title={t('adminDocumentReviewVerifyConfirmTitle')}
        description={t('adminDocumentReviewVerifyConfirmDescription')}
        confirmLabel={t('adminDocumentReviewVerifyConfirmAction')}
        cancelLabel={t('adminDocumentReviewCancelAction')}
        closeLabel={t('dsClose')}
        onConfirm={decision.confirm}
        isConfirming={decision.mutation.isPending}
      >
        {nonFieldDecisionError ? <ValidationMessage tone="error">{nonFieldDecisionError}</ValidationMessage> : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={decision.confirmTarget?.action === 'rejected'}
        onOpenChange={(open) => (!open ? decision.closeConfirm() : undefined)}
        title={t('adminDocumentReviewRejectConfirmTitle')}
        description={t('adminDocumentReviewRejectConfirmDescription')}
        confirmLabel={t('adminDocumentReviewRejectConfirmAction')}
        cancelLabel={t('adminDocumentReviewCancelAction')}
        closeLabel={t('dsClose')}
        onConfirm={decision.confirm}
        confirmVariant="destructive"
        isConfirming={decision.mutation.isPending}
      >
        <Textarea
          label={t('adminDocumentReviewRejectReasonLabel')}
          helperText={rejectionFieldError ? undefined : t('adminDocumentReviewRejectReasonHelper')}
          errorMessage={rejectionFieldError}
          value={decision.reason}
          onChange={(event) => decision.setReason(event.target.value)}
          disabled={decision.mutation.isPending}
        />
        {nonFieldDecisionError ? <ValidationMessage tone="error">{nonFieldDecisionError}</ValidationMessage> : null}
      </ConfirmDialog>

      {previewDocument ? (
        <DocumentPreview
          document={previewDocument}
          access={documentAccess.access}
          isRequesting={documentAccess.isRequesting}
          error={documentAccess.error}
          isExpired={documentAccess.isExpired}
          onClose={closePreview}
          onRequestNewAccess={() => documentAccess.requestAccess(previewDocument.id)}
        />
      ) : null}
    </div>
  );
}

interface DocumentRowProps {
  document: SubmissionDocument;
  onPreview: () => void;
  onVerify: () => void;
  onReject: () => void;
}

function DocumentRow({ document, onPreview, onVerify, onReject }: DocumentRowProps) {
  const { t, language } = useLanguage();
  const canDecide = document.status === 'pending_review';

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-medium text-text-primary">{document.name}</h2>
            <Badge tone="neutral">{document.required ? t('dsRequiredField') : t('dsOptionalField')}</Badge>
            <Badge tone={DOCUMENT_STATUS_TONES[document.status]}>{t(DOCUMENT_STATUS_KEYS[document.status])}</Badge>
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-text-tertiary">{t('adminDocumentReviewFileNameLabel')}</dt>
              <dd className="text-text-primary">{document.fileName}</dd>
            </div>
            <div>
              <dt className="text-text-tertiary">{t('adminDocumentReviewContentTypeLabel')}</dt>
              <dd className="text-text-primary">{document.contentType}</dd>
            </div>
            <div>
              <dt className="text-text-tertiary">{t('adminDocumentReviewFileSizeLabel')}</dt>
              <dd className="text-text-primary">{formatFileSize(document.fileSize, language)}</dd>
            </div>
            <div>
              <dt className="text-text-tertiary">{t('adminDocumentReviewUploadedAtLabel')}</dt>
              <dd className="text-text-primary">{formatDate(document.uploadedAt, language, { dateStyle: 'medium', timeStyle: 'short' })}</dd>
            </div>
            {document.verifiedAt ? (
              <div>
                <dt className="text-text-tertiary">{t('adminDocumentReviewDecidedAtLabel')}</dt>
                <dd className="text-text-primary">{formatDate(document.verifiedAt, language, { dateStyle: 'medium', timeStyle: 'short' })}</dd>
              </div>
            ) : null}
            {document.reviewerId ? (
              <div>
                <dt className="text-text-tertiary">{t('adminDocumentReviewReviewerLabel')}</dt>
                <dd className="text-text-primary">{document.reviewerId}</dd>
              </div>
            ) : null}
          </dl>
          {document.rejectionReason ? (
            <p className="mt-2 text-sm text-danger">
              <span className="font-medium">{t('adminDocumentReviewRejectionReasonLabel')}: </span>
              {document.rejectionReason}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onPreview}>
            {t('adminDocumentReviewPreviewAction')}
          </Button>
          {canDecide ? (
            <>
              <Button variant="primary" size="sm" onClick={onVerify}>
                {t('adminDocumentReviewVerifyAction')}
              </Button>
              <Button variant="destructive" size="sm" onClick={onReject}>
                {t('adminDocumentReviewRejectAction')}
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

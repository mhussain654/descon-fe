import { useState } from 'react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import { Badge, Button, Card, ConfirmDialog, Dialog, DialogContent, ErrorState, LoadingState, Textarea, ValidationMessage, toast } from '../../../../design-system';
import { formatDate } from '../../../../../../shared/i18n/locale';
import { formatFileSize } from '../../../../../../shared/adminDocumentReviews/formatting';
import type { AdminBankDetailStatus } from '../../../../../../shared/adminBankDetails/types';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import { resolveDocumentAccessUrl } from '../../../../lib/resolveDocumentAccessUrl';
import { useAdminBankDetail, useBankDetailDecision, useBankProofAccess } from '../hooks/useBankDetailReview';

const STATUS_KEYS: Record<AdminBankDetailStatus, TranslationKey> = {
  submitted: 'candidateDocumentsStatusPendingReview',
  verified: 'verified',
  rejected: 'rejected',
};
const STATUS_TONES: Record<AdminBankDetailStatus, 'info' | 'success' | 'danger'> = {
  submitted: 'info',
  verified: 'success',
  rejected: 'danger',
};

/**
 * The candidate's bank account details on the submission page, reviewed like
 * a document: Preview the proof, then Verify, or Reject with a reason. Only
 * staff who can see full bank details (manage_payments) see the details and
 * the actions; other reviewers see that they are reviewed by Finance.
 */
export function BankDetailReviewCard({ candidateId }: { candidateId: string }) {
  const { t, language } = useLanguage();
  const { hasPermission } = useStaffAuth();
  const canReview = hasPermission('manage_payments');
  const query = useAdminBankDetail(candidateId, canReview);
  const { decide, mutation } = useBankDetailDecision(candidateId);
  const proof = useBankProofAccess(candidateId);
  const [confirm, setConfirm] = useState<'verified' | 'rejected' | null>(null);
  const [reason, setReason] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  const header = (badge?: React.ReactNode) => (
    <div className="flex items-center gap-2">
      <h2 className="font-medium text-text-primary">{t('candidateBankDetailsTitle')}</h2>
      <Badge tone="neutral">{t('dsRequiredField')}</Badge>
      {badge}
    </div>
  );

  if (!canReview) {
    return (
      <Card>
        {header()}
        <p className="mt-2 text-sm text-text-tertiary">{t('adminBankReviewFinanceOnly')}</p>
      </Card>
    );
  }
  if (query.isLoading) return <Card><LoadingState message={t('loading')} /></Card>;
  if (query.isError) {
    return (
      <Card>
        {header()}
        <ErrorState message={query.error.message || t('somethingWentWrong')} retryLabel={t('retry')} onRetry={() => query.refetch()} />
      </Card>
    );
  }

  const bankDetail = query.data;
  if (!bankDetail) {
    return (
      <Card>
        {header()}
        <p className="mt-2 text-sm text-text-tertiary">{t('adminBankReviewNotAdded')}</p>
      </Card>
    );
  }

  const closeConfirm = () => {
    if (mutation.isPending) return;
    setConfirm(null);
    setReason('');
    mutation.reset();
  };
  const submitDecision = () => {
    const decision = confirm === 'rejected' ? { action: 'rejected' as const, reason: reason.trim() } : { action: 'verified' as const };
    decide(decision, {
      onSuccess: () => {
        toast.success(t(confirm === 'rejected' ? 'adminBankReviewRejectedToast' : 'adminBankReviewVerifiedToast'));
        setConfirm(null);
        setReason('');
      },
    });
  };
  const openPreview = () => {
    setPreviewOpen(true);
    proof.request();
  };
  const closePreview = () => {
    setPreviewOpen(false);
    proof.clear();
  };
  const reasonError = mutation.error?.field === 'rejection.reason' ? mutation.error.message || t('somethingWentWrong') : undefined;
  const otherError = mutation.isError && !reasonError ? mutation.error.message || t('somethingWentWrong') : undefined;
  const proofUrl = proof.access ? resolveDocumentAccessUrl(proof.access.url, import.meta.env.VITE_API_BASE_URL ?? '') : null;
  const isPdf = bankDetail.proof.contentType === 'application/pdf';

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {header(<Badge tone={STATUS_TONES[bankDetail.status]}>{t(STATUS_KEYS[bankDetail.status])}</Badge>)}
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-text-tertiary">{t('candidateBankDetailsAccountTitleLabel')}</dt>
              <dd className="text-text-primary">{bankDetail.accountTitle}</dd>
            </div>
            <div>
              <dt className="text-text-tertiary">{t('candidateBankDetailsAccountNumberLabel')}</dt>
              <dd dir="ltr" className="font-mono text-text-primary">{bankDetail.accountNumber}</dd>
            </div>
            <div>
              <dt className="text-text-tertiary">{t('candidateBankDetailsBankNameLabel')}</dt>
              <dd className="text-text-primary">{bankDetail.bankName}</dd>
            </div>
            <div>
              <dt className="text-text-tertiary">{t('candidateBankDetailsProofLabel')}</dt>
              <dd className="truncate text-text-primary">
                {bankDetail.proof.fileName} • {formatFileSize(bankDetail.proof.fileSize, language)}
              </dd>
            </div>
            <div>
              <dt className="text-text-tertiary">{t('adminDocumentReviewUploadedAtLabel')}</dt>
              <dd className="text-text-primary">{formatDate(bankDetail.submittedAt, language, { dateStyle: 'medium', timeStyle: 'short' })}</dd>
            </div>
            {bankDetail.reviewedAt ? (
              <div>
                <dt className="text-text-tertiary">{t('adminDocumentReviewDecidedAtLabel')}</dt>
                <dd className="text-text-primary">{formatDate(bankDetail.reviewedAt, language, { dateStyle: 'medium', timeStyle: 'short' })}</dd>
              </div>
            ) : null}
          </dl>
          {bankDetail.rejectionReason ? (
            <p className="mt-2 text-sm text-danger-emphasis">
              {t('adminDocumentReviewRejectReasonLabel')}: {bankDetail.rejectionReason}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={openPreview}>{t('adminDocumentReviewPreviewAction')}</Button>
          {bankDetail.status === 'submitted' ? (
            <>
              <Button size="sm" onClick={() => setConfirm('verified')}>{t('adminDocumentReviewVerifyAction')}</Button>
              <Button size="sm" variant="destructive" onClick={() => setConfirm('rejected')}>{t('adminDocumentReviewRejectAction')}</Button>
            </>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={confirm === 'verified'}
        onOpenChange={(open) => (!open ? closeConfirm() : undefined)}
        title={t('adminBankReviewVerifyConfirmTitle')}
        description={t('adminBankReviewVerifyConfirmDescription')}
        confirmLabel={t('adminDocumentReviewVerifyConfirmAction')}
        cancelLabel={t('adminDocumentReviewCancelAction')}
        closeLabel={t('dsClose')}
        onConfirm={submitDecision}
        isConfirming={mutation.isPending}
      >
        {otherError ? <ValidationMessage tone="error">{otherError}</ValidationMessage> : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm === 'rejected'}
        onOpenChange={(open) => (!open ? closeConfirm() : undefined)}
        title={t('adminBankReviewRejectConfirmTitle')}
        description={t('adminBankReviewRejectConfirmDescription')}
        confirmLabel={t('adminDocumentReviewRejectConfirmAction')}
        cancelLabel={t('adminDocumentReviewCancelAction')}
        closeLabel={t('dsClose')}
        onConfirm={submitDecision}
        confirmVariant="destructive"
        isConfirming={mutation.isPending}
      >
        <Textarea
          label={t('adminDocumentReviewRejectReasonLabel')}
          helperText={reasonError ? undefined : t('adminDocumentReviewRejectReasonHelper')}
          errorMessage={reasonError}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={mutation.isPending}
        />
        {otherError ? <ValidationMessage tone="error">{otherError}</ValidationMessage> : null}
      </ConfirmDialog>

      {previewOpen ? (
        <Dialog open onOpenChange={(open) => (!open ? closePreview() : undefined)}>
          <DialogContent title={t('candidateBankDetailsTitle')} closeLabel={t('dsClose')}>
            {proof.isRequesting ? <LoadingState message={t('loading')} /> : null}
            {proof.error ? (
              <ErrorState message={proof.error.message || t('somethingWentWrong')} retryLabel={t('retry')} onRetry={proof.request} />
            ) : null}
            {proof.access && !proofUrl ? <ErrorState message={t('somethingWentWrong')} retryLabel={t('retry')} onRetry={proof.request} /> : null}
            {proofUrl ? (
              isPdf ? (
                <embed src={proofUrl} type="application/pdf" title={bankDetail.proof.fileName} className="h-[70vh] w-full rounded-lg" />
              ) : (
                <img src={proofUrl} alt={bankDetail.proof.fileName} className="max-h-[70vh] w-full rounded-lg object-contain" />
              )
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}
    </Card>
  );
}

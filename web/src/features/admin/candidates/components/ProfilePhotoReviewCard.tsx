import { useState } from 'react';
import { Badge, Button, Card, ConfirmDialog, ValidationMessage, toast } from '../../../../design-system';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import type { AdminCandidateProfilePhotoStatus } from '../../../../../../shared/adminCandidates/types';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import { formatDate } from '../../../../../../shared/i18n/locale';
import { resolveDocumentAccessUrl } from '../../../../lib/resolveDocumentAccessUrl';
import { useCandidateDetail } from '../hooks/useCandidateDetail';
import { useProfilePhotoDecision } from '../hooks/useProfilePhotoDecision';

const STATUS_KEYS: Record<AdminCandidateProfilePhotoStatus, TranslationKey> = {
  pending: 'adminProfilePhotoStatusPending',
  approved: 'adminProfilePhotoStatusApproved',
  rejected: 'adminProfilePhotoStatusRejected',
};
const STATUS_TONES: Record<AdminCandidateProfilePhotoStatus, 'info' | 'success' | 'danger'> = {
  pending: 'info',
  approved: 'success',
  rejected: 'danger',
};

/**
 * The candidate's profile photo, which must clearly show their own face.
 * Document reviewers approve it, or reject it: a rejected photo is removed
 * and the app asks the candidate for a new one.
 */
export function ProfilePhotoReviewCard({ candidateId }: { candidateId: string }) {
  const { t, language } = useLanguage();
  const { hasPermission } = useStaffAuth();
  const canReview = hasPermission('manage_candidate_documents');
  const { data: candidate } = useCandidateDetail(candidateId);
  const decision = useProfilePhotoDecision(candidateId);
  const [confirmReject, setConfirmReject] = useState(false);

  const photo = candidate?.profilePhoto ?? null;
  if (!candidate) return null;

  const photoUrl = photo?.url ? resolveDocumentAccessUrl(photo.url, import.meta.env.VITE_API_BASE_URL ?? '') : null;
  const errorMessage = decision.isError ? decision.error.message || t('somethingWentWrong') : undefined;

  const decide = (value: 'approved' | 'rejected') => {
    decision.mutate(value, {
      onSuccess: () => {
        toast.success(t(value === 'approved' ? 'adminProfilePhotoApprovedToast' : 'adminProfilePhotoRejectedToast'));
        setConfirmReject(false);
      },
    });
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-medium text-text-primary">{t('adminProfilePhotoTitle')}</h2>
        {photo?.status ? <Badge tone={STATUS_TONES[photo.status]}>{t(STATUS_KEYS[photo.status])}</Badge> : null}
      </div>

      {photoUrl ? (
        <div className="mt-3 flex flex-wrap items-start gap-4">
          <img src={photoUrl} alt={t('adminProfilePhotoTitle')} className="h-40 w-40 rounded-xl border border-border object-cover" />
          <div className="min-w-0 flex-1 space-y-3">
            <p className="text-sm text-text-secondary">{t('adminProfilePhotoHint')}</p>
            {photo?.reviewedAt ? (
              <p className="text-sm text-text-tertiary">
                {t('adminDocumentReviewDecidedAtLabel')}: {formatDate(photo.reviewedAt, language, { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            ) : null}
            {canReview ? (
              <div className="flex flex-wrap gap-2">
                {photo?.status !== 'approved' ? (
                  <Button size="sm" onClick={() => decide('approved')} disabled={decision.isPending}>
                    {t('adminProfilePhotoApproveAction')}
                  </Button>
                ) : null}
                <Button size="sm" variant="destructive" onClick={() => setConfirmReject(true)} disabled={decision.isPending}>
                  {t('adminProfilePhotoRejectAction')}
                </Button>
              </div>
            ) : null}
            {errorMessage && !confirmReject ? <ValidationMessage tone="error">{errorMessage}</ValidationMessage> : null}
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-text-tertiary">
          {photo?.status === 'rejected' ? t('adminProfilePhotoRejectedNote') : t('adminProfilePhotoNone')}
        </p>
      )}

      <ConfirmDialog
        open={confirmReject}
        onOpenChange={(open) => (!open && !decision.isPending ? setConfirmReject(false) : undefined)}
        title={t('adminProfilePhotoRejectConfirmTitle')}
        description={t('adminProfilePhotoRejectConfirmDescription')}
        confirmLabel={t('adminProfilePhotoRejectAction')}
        cancelLabel={t('adminDocumentReviewCancelAction')}
        closeLabel={t('dsClose')}
        onConfirm={() => decide('rejected')}
        confirmVariant="destructive"
        isConfirming={decision.isPending}
      >
        {errorMessage ? <ValidationMessage tone="error">{errorMessage}</ValidationMessage> : null}
      </ConfirmDialog>
    </Card>
  );
}

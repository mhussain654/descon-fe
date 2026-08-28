import { useEffect } from 'react';
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
  ProgressBar,
  SessionExpiredState,
  ValidationMessage,
} from '../../../../design-system';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { CANDIDATE_DOCUMENT_STATUS_KEYS } from '../../../../../../shared/candidateDocuments/statusLabels';
import {
  APPLICATION_SUBMISSION_STATE_KEYS,
  APPLICATION_SUBMISSION_STATE_TONES,
  BLOCKING_REQUIREMENT_REASON_KEYS,
} from '../../../../../../shared/applicationProgress/statusLabels';
import { APPLICATION_PROGRESS_ERROR_KEYS } from '../../../../../../shared/applicationProgress/errorMessages';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import { useApplicationProgress } from '../hooks/useApplicationProgress';
import { useSubmitDocuments } from '../hooks/useSubmitDocuments';

export interface ApplicationProgressSummaryProps {
  /** Signs the candidate out and returns them to sign-in -- used for both the progress fetch's and a submission's session-expired/inactive-account outcomes. */
  onReturnToSignIn: () => void;
}

/** Error codes that can be resolved by simply pressing "Try again" with the same idempotency key (ticket: "Offline/network/timeout/5xx: allow manual retry with the same key.") -- shown inline in the confirmation dialog rather than closing it. */
const RETRYABLE_ERROR_CODES = new Set(['OFFLINE', 'NETWORK_ERROR', 'SERVER_ERROR', 'RATE_LIMITED', 'IN_PROGRESS', 'CONFLICT']);

export function ApplicationProgressSummary({ onReturnToSignIn }: ApplicationProgressSummaryProps) {
  const { t } = useLanguage();
  const query = useApplicationProgress();
  const submit = useSubmitDocuments();

  useEffect(() => {
    if (submit.mutation.error?.code === 'SESSION_EXPIRED' || submit.mutation.error?.code === 'INACTIVE_ACCOUNT') {
      onReturnToSignIn();
    }
  }, [submit.mutation.error, onReturnToSignIn]);

  if (query.isLoading) {
    return <LoadingState message={t('loading')} />;
  }

  const error = query.error;
  if (error?.code === 'SESSION_EXPIRED') {
    return (
      <SessionExpiredState
        title={t('dsSessionExpiredTitle')}
        description={t('dsSessionExpiredDescription')}
        actionLabel={t('dsSessionExpiredAction')}
        onAction={onReturnToSignIn}
      />
    );
  }
  if (error?.code === 'INACTIVE_ACCOUNT') {
    return (
      <ForbiddenState
        title={t('candidateProfileInactiveAccountTitle')}
        description={t('candidateProfileInactiveAccountDescription')}
        actionLabel={t('candidateProfileInactiveAccountAction')}
        onAction={onReturnToSignIn}
      />
    );
  }
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
  if (error) {
    const key = APPLICATION_PROGRESS_ERROR_KEYS[error.code] as TranslationKey;
    return <ErrorState message={error.message ?? t(key)} retryLabel={t('retry')} onRetry={() => query.refetch()} />;
  }

  if (!query.data) {
    return <ErrorState message={t('somethingWentWrong')} retryLabel={t('retry')} onRetry={() => query.refetch()} />;
  }

  const progress = query.data;
  const documents = progress.documents;
  const stateKey = APPLICATION_SUBMISSION_STATE_KEYS[documents.submissionState] as TranslationKey;
  const tone = APPLICATION_SUBMISSION_STATE_TONES[documents.submissionState];

  if (documents.submissionState === 'no_assignment') {
    return <EmptyState title={t(stateKey)} description={t('applicationProgressNoAssignmentEmptyDescription')} />;
  }
  if (documents.submissionState === 'no_requirements') {
    return <EmptyState title={t(stateKey)} description={t('applicationProgressNoRequirementsEmptyDescription')} />;
  }

  // The ONLY signal gating the submit action -- never inferred from counts
  // or statuses (ticket: "Do not infer submission eligibility from document
  // counts or statuses. Use the backend's can_submit.").
  const showSubmitAction = documents.canSubmit === true;
  const dialogError = submit.mutation.error;
  const showDialogError = dialogError && RETRYABLE_ERROR_CODES.has(dialogError.code);

  return (
    <Card className="mb-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-text-primary">{t('applicationProgressTitle')}</h2>
        <Badge tone={tone}>{t(stateKey)}</Badge>
      </div>

      {progress.currentWorkflowStage ? (
        <p className="mb-3 text-sm text-text-secondary">
          {t('applicationProgressWorkflowStageLabel')}: <span className="font-medium text-text-primary">{progress.currentWorkflowStage.name}</span>
        </p>
      ) : null}

      <ProgressBar
        value={documents.completionPercentage}
        label={t('applicationProgressCompletionLabel')}
        // See DocumentChecklistView.tsx's identical comment: isolates the
        // numeral/symbol string as an LTR run under Urdu's RTL layout.
        displayText={`⁦${documents.submittedTotal} / ${documents.requiredTotal} · ${documents.completionPercentage}%⁩`}
      />

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        {(
          [
            ['missing', documents.missing],
            ['uploaded', documents.uploaded],
            ['pending_review', documents.pendingReview],
            ['verified', documents.verified],
            ['rejected', documents.rejected],
          ] as const
        ).map(([status, count]) => (
          <div key={status}>
            <dt className="text-text-secondary">{t(CANDIDATE_DOCUMENT_STATUS_KEYS[status] as TranslationKey)}</dt>
            <dd className="text-base font-medium text-text-primary">{count}</dd>
          </div>
        ))}
      </dl>

      {documents.blockingRequirements.length > 0 ? (
        <div className="mt-5">
          <h3 className="mb-2 text-sm font-semibold text-text-primary">{t('applicationProgressBlockingTitle')}</h3>
          <ul className="space-y-1.5">
            {documents.blockingRequirements.map((requirement) => (
              <li key={requirement.requirementCode} className="text-sm text-text-secondary">
                <span className="font-medium text-text-primary">{requirement.name}</span>
                {' — '}
                <span>{t(BLOCKING_REQUIREMENT_REASON_KEYS[requirement.reason] as TranslationKey)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {showSubmitAction ? (
        <div className="mt-5">
          <Button onClick={submit.openConfirm} disabled={submit.mutation.isPending}>
            {t('applicationProgressSubmitAction')}
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={submit.confirmOpen}
        onOpenChange={(open) => (open ? submit.openConfirm() : submit.closeConfirm())}
        title={t('applicationProgressConfirmTitle')}
        description={t('applicationProgressConfirmDescription')}
        confirmLabel={submit.mutation.isPending ? t('applicationProgressSubmitting') : t('applicationProgressConfirmAction')}
        cancelLabel={t('applicationProgressConfirmCancel')}
        closeLabel={t('dsClose')}
        onConfirm={submit.confirm}
        isConfirming={submit.mutation.isPending}
      >
        {showDialogError ? (
          <ValidationMessage tone="error">
            {dialogError.message ?? t(APPLICATION_PROGRESS_ERROR_KEYS[dialogError.code] as TranslationKey)}
          </ValidationMessage>
        ) : null}
      </ConfirmDialog>
    </Card>
  );
}

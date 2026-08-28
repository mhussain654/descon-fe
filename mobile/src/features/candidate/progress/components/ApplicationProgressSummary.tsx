import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
import { colors, fontWeights, spacing } from '../../../../design-system/tokens';
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

/** Mirrors web's ApplicationProgressSummary.tsx's identical RETRYABLE_ERROR_CODES exactly. */
const RETRYABLE_ERROR_CODES = new Set(['OFFLINE', 'NETWORK_ERROR', 'SERVER_ERROR', 'RATE_LIMITED', 'IN_PROGRESS', 'CONFLICT']);

const COUNT_ROWS = [
  ['missing', 'missing'],
  ['uploaded', 'uploaded'],
  ['pending_review', 'pendingReview'],
  ['verified', 'verified'],
  ['rejected', 'rejected'],
] as const;

/** The full candidate application-progress + submission screen content. Mirrors web's ApplicationProgressSummary.tsx exactly. */
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
      <OfflineState title={t('dsOfflineTitle')} description={t('dsOfflineDescription')} retryLabel={t('retry')} onRetry={() => query.refetch()} />
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

  const showSubmitAction = documents.canSubmit === true;
  const dialogError = submit.mutation.error;
  const showDialogError = dialogError && RETRYABLE_ERROR_CODES.has(dialogError.code);

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('applicationProgressTitle')}</Text>
        <Badge tone={tone}>{t(stateKey)}</Badge>
      </View>

      {progress.currentWorkflowStage ? (
        <Text style={styles.workflowStage}>
          {t('applicationProgressWorkflowStageLabel')}: <Text style={styles.workflowStageValue}>{progress.currentWorkflowStage.name}</Text>
        </Text>
      ) : null}

      <ProgressBar
        value={documents.completionPercentage}
        label={t('applicationProgressCompletionLabel')}
        // See DocumentChecklistView.tsx's identical comment: isolates the
        // numeral/symbol string as an LTR run under Urdu's RTL layout.
        displayText={`⁦${documents.submittedTotal} / ${documents.requiredTotal} · ${documents.completionPercentage}%⁩`}
      />

      <View style={styles.counts}>
        {COUNT_ROWS.map(([status, field]) => (
          <View key={status} style={styles.countItem}>
            <Text style={styles.countLabel}>{t(CANDIDATE_DOCUMENT_STATUS_KEYS[status] as TranslationKey)}</Text>
            <Text style={styles.countValue}>{documents[field]}</Text>
          </View>
        ))}
      </View>

      {documents.blockingRequirements.length > 0 ? (
        <View style={styles.blocking}>
          <Text style={styles.blockingTitle}>{t('applicationProgressBlockingTitle')}</Text>
          {documents.blockingRequirements.map((requirement) => (
            <Text key={requirement.requirementCode} style={styles.blockingItem}>
              <Text style={styles.blockingName}>{requirement.name}</Text>
              {' — '}
              <Text>{t(BLOCKING_REQUIREMENT_REASON_KEYS[requirement.reason] as TranslationKey)}</Text>
            </Text>
          ))}
        </View>
      ) : null}

      {showSubmitAction ? (
        <View style={styles.submitRow}>
          <Button onPress={submit.openConfirm} disabled={submit.mutation.isPending}>
            {t('applicationProgressSubmitAction')}
          </Button>
        </View>
      ) : null}

      <ConfirmDialog
        open={submit.confirmOpen}
        onOpenChange={(open) => (open ? submit.openConfirm() : submit.closeConfirm())}
        title={t('applicationProgressConfirmTitle')}
        description={t('applicationProgressConfirmDescription')}
        confirmLabel={submit.mutation.isPending ? t('applicationProgressSubmitting') : t('applicationProgressConfirmAction')}
        cancelLabel={t('applicationProgressConfirmCancel')}
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

const styles = StyleSheet.create({
  card: { marginBottom: spacing[5] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[4], gap: spacing[2] },
  title: { fontSize: 17, fontWeight: fontWeights.semibold, color: colors.text.primary },
  workflowStage: { fontSize: 13, color: colors.text.secondary, marginBottom: spacing[3] },
  workflowStageValue: { fontWeight: fontWeights.medium, color: colors.text.primary },
  counts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[4], marginTop: spacing[4] },
  countItem: { minWidth: 90 },
  countLabel: { fontSize: 12, color: colors.text.secondary },
  countValue: { fontSize: 16, fontWeight: fontWeights.medium, color: colors.text.primary },
  blocking: { marginTop: spacing[5], gap: spacing[1.5] },
  blockingTitle: { fontSize: 13, fontWeight: fontWeights.semibold, color: colors.text.primary, marginBottom: spacing[1] },
  blockingItem: { fontSize: 13, color: colors.text.secondary },
  blockingName: { fontWeight: fontWeights.medium, color: colors.text.primary },
  submitRow: { marginTop: spacing[5] },
});

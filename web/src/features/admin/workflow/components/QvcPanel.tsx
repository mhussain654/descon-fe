import { useState } from 'react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import {
  Badge,
  Button,
  ConfirmDialog,
  ErrorState,
  Input,
  LoadingState,
  OfflineState,
  Select,
  Textarea,
  ValidationMessage,
} from '../../../../design-system';
import { formatDate } from '../../../../../../shared/i18n/locale';
import { ADMIN_WORKFLOW_ERROR_KEYS } from '../../../../../../shared/adminWorkflow/errorMessages';
import { QVC_ATTEMPT_STATUS_KEYS, QVC_OUTCOME_SELECT_VALUES } from '../../../../../../shared/adminWorkflow/qvcOutcomeLabels';
import type { AdminQvcAttempt, QvcOutcomeCode } from '../../../../../../shared/adminWorkflow/types';
import { ADMIN_REVIEWER_ROLE_KEYS } from '../../../../../../shared/adminDocumentReviews/statusLabels';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import type { useQvcActions } from '../hooks/useQvcActions';
import type { useQvcAttempts } from '../hooks/useQvcAttempts';

export interface QvcPanelProps {
  canTransition: boolean;
  attemptsQuery: ReturnType<typeof useQvcAttempts>;
  actions: ReturnType<typeof useQvcActions>;
  currentStageCode: string | undefined;
}

function attemptStatusTone(status: AdminQvcAttempt['status']): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'approved') return 'success';
  if (status === 're_medical') return 'warning';
  if (status === 'rejected' || status === 'no_show') return 'danger';
  return 'info';
}

/**
 * Staff QVC (medical exam) panel -- scheduling, outcome recording and
 * attempt history (MPS-F501 Phase B). Presentational: `WorkflowPanel`
 * fetches `attemptsQuery`/`actions` so a session-ending error from either
 * one is caught by the same single monitoring effect that already covers
 * the rest of the panel.
 */
export function QvcPanel({ canTransition, attemptsQuery, actions, currentStageCode }: QvcPanelProps) {
  const { t } = useLanguage();

  const attempts = attemptsQuery.data?.qvcAttempts ?? [];
  const openAttempt = attempts.find((attempt) => attempt.status === 'scheduled');

  return (
    <div className="mt-6 border-t border-border pt-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-text-primary">{t('adminWorkflowQvcPanelTitle')}</h3>
        {canTransition && !openAttempt ? (
          <Button type="button" variant="secondary" onClick={actions.openScheduleDialog}>
            {t('adminWorkflowQvcScheduleAction')}
          </Button>
        ) : null}
      </div>

      <QvcPanelBody
        attemptsQuery={attemptsQuery}
        canTransition={canTransition}
        openAttemptId={openAttempt?.id}
        onRecordOutcome={actions.openOutcomeDialog}
      />

      {actions.staleNotice ? (
        <div className="mt-3">
          <ValidationMessage tone="error">{t('adminWorkflowStaleNoticeMessage')}</ValidationMessage>
        </div>
      ) : null}

      <ScheduleDialog actions={actions} currentStageCode={currentStageCode} />
      <OutcomeDialog actions={actions} currentStageCode={currentStageCode} attempt={openAttempt} />
    </div>
  );
}

interface QvcPanelBodyProps {
  attemptsQuery: ReturnType<typeof useQvcAttempts>;
  canTransition: boolean;
  openAttemptId: string | undefined;
  onRecordOutcome: (attemptId: string) => void;
}

function QvcPanelBody({ attemptsQuery, canTransition, openAttemptId, onRecordOutcome }: QvcPanelBodyProps) {
  const { t } = useLanguage();

  if (attemptsQuery.isLoading) {
    return <LoadingState message={t('loading')} />;
  }
  if (attemptsQuery.error?.code === 'OFFLINE') {
    return (
      <OfflineState
        title={t('dsOfflineTitle')}
        description={t('dsOfflineDescription')}
        retryLabel={t('retry')}
        onRetry={() => attemptsQuery.refetch()}
      />
    );
  }
  if (attemptsQuery.error) {
    const messageKey = ADMIN_WORKFLOW_ERROR_KEYS[attemptsQuery.error.code] as TranslationKey;
    return (
      <ErrorState
        message={attemptsQuery.error.message || t(messageKey)}
        retryLabel={t('retry')}
        onRetry={() => attemptsQuery.refetch()}
      />
    );
  }

  const attempts = attemptsQuery.data?.qvcAttempts ?? [];
  if (attempts.length === 0) {
    return <p className="text-sm text-text-secondary">{t('adminWorkflowQvcAttemptsEmpty')}</p>;
  }

  return (
    <ul className="space-y-2">
      {attempts.map((attempt) => (
        <QvcAttemptRow
          key={attempt.id}
          attempt={attempt}
          canRecordOutcome={canTransition && attempt.id === openAttemptId}
          onRecordOutcome={() => onRecordOutcome(attempt.id)}
        />
      ))}
    </ul>
  );
}

function QvcAttemptRow({
  attempt,
  canRecordOutcome,
  onRecordOutcome,
}: {
  attempt: AdminQvcAttempt;
  canRecordOutcome: boolean;
  onRecordOutcome: () => void;
}) {
  const { t, language } = useLanguage();

  return (
    <li className="rounded-lg border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-medium text-text-primary">
          {t('adminWorkflowQvcAttemptPrefix')} {attempt.attemptNumber} · {formatDate(attempt.appointmentDate, language, { dateStyle: 'medium' })}
        </div>
        <Badge tone={attemptStatusTone(attempt.status)}>{t(QVC_ATTEMPT_STATUS_KEYS[attempt.status] as TranslationKey)}</Badge>
      </div>
      <div className="mt-1 text-xs text-text-tertiary">
        {t('adminWorkflowQvcScheduledByPrefix')}{' '}
        {attempt.scheduledBy ? t(ADMIN_REVIEWER_ROLE_KEYS[attempt.scheduledBy.role] as TranslationKey) : t('adminWorkflowUnknownActor')}
        {attempt.outcomeRecordedAt ? (
          <>
            {' • '}
            {t('adminWorkflowQvcOutcomeRecordedByPrefix')}{' '}
            {attempt.outcomeRecordedBy ? t(ADMIN_REVIEWER_ROLE_KEYS[attempt.outcomeRecordedBy.role] as TranslationKey) : t('adminWorkflowUnknownActor')}
            {' • '}
            {formatDate(attempt.outcomeRecordedAt, language, { dateStyle: 'medium', timeStyle: 'short' })}
          </>
        ) : null}
      </div>
      {attempt.internalNote ? <p className="mt-2 text-xs text-text-secondary">{attempt.internalNote}</p> : null}
      {canRecordOutcome ? (
        <div className="mt-3">
          <Button type="button" size="sm" onClick={onRecordOutcome}>
            {t('adminWorkflowQvcRecordOutcomeAction')}
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function ScheduleDialog({
  actions,
  currentStageCode,
}: {
  actions: ReturnType<typeof useQvcActions>;
  currentStageCode: string | undefined;
}) {
  const { t } = useLanguage();
  const [appointmentDate, setAppointmentDate] = useState('');
  const [note, setNote] = useState('');
  const [dateError, setDateError] = useState<string | undefined>(undefined);

  const mutationError = actions.scheduleMutation.error;
  const conflictMessage =
    mutationError?.code === 'IDEMPOTENCY_CONFLICT'
      ? mutationError.message || t(ADMIN_WORKFLOW_ERROR_KEYS.IDEMPOTENCY_CONFLICT as TranslationKey)
      : undefined;
  const generalError =
    mutationError && !conflictMessage
      ? mutationError.message || t(ADMIN_WORKFLOW_ERROR_KEYS[mutationError.code] as TranslationKey)
      : undefined;

  const handleOpenChange = (open: boolean) => {
    if (open) return;
    actions.closeScheduleDialog();
    setAppointmentDate('');
    setNote('');
    setDateError(undefined);
  };

  const handleConfirm = () => {
    if (!appointmentDate) {
      setDateError(t('adminWorkflowQvcAppointmentDateRequiredError'));
      return;
    }
    setDateError(undefined);
    actions.submitSchedule(appointmentDate, currentStageCode, note.trim() || undefined);
  };

  return (
    <ConfirmDialog
      open={actions.scheduleDialogOpen}
      onOpenChange={handleOpenChange}
      title={t('adminWorkflowQvcScheduleDialogTitle')}
      description={t('adminWorkflowQvcScheduleDialogDescription')}
      confirmLabel={t('adminWorkflowQvcScheduleConfirmAction')}
      cancelLabel={t('adminWorkflowCancelAction')}
      closeLabel={t('dsClose')}
      onConfirm={handleConfirm}
      isConfirming={actions.scheduleMutation.isPending}
    >
      <div className="space-y-4">
        <Input
          type="date"
          label={t('adminWorkflowQvcAppointmentDateLabel')}
          value={appointmentDate}
          onChange={(event) => setAppointmentDate(event.target.value)}
          errorMessage={dateError}
        />
        <Textarea label={t('adminWorkflowQvcNoteLabel')} value={note} onChange={(event) => setNote(event.target.value)} rows={2} />
        {conflictMessage ? <ValidationMessage tone="error">{conflictMessage}</ValidationMessage> : null}
        {generalError ? <ValidationMessage tone="error">{generalError}</ValidationMessage> : null}
      </div>
    </ConfirmDialog>
  );
}

function OutcomeDialog({
  actions,
  currentStageCode,
  attempt,
}: {
  actions: ReturnType<typeof useQvcActions>;
  currentStageCode: string | undefined;
  attempt: AdminQvcAttempt | undefined;
}) {
  const { t } = useLanguage();
  const [selection, setSelection] = useState<QvcOutcomeCode | 'no_show' | ''>('');
  const [note, setNote] = useState('');
  const [selectionError, setSelectionError] = useState<string | undefined>(undefined);

  const mutationError = actions.outcomeMutation.error;
  const conflictMessage =
    mutationError?.code === 'IDEMPOTENCY_CONFLICT'
      ? mutationError.message || t(ADMIN_WORKFLOW_ERROR_KEYS.IDEMPOTENCY_CONFLICT as TranslationKey)
      : undefined;
  const generalError =
    mutationError && !conflictMessage
      ? mutationError.message || t(ADMIN_WORKFLOW_ERROR_KEYS[mutationError.code] as TranslationKey)
      : undefined;

  const handleOpenChange = (open: boolean) => {
    if (open) return;
    actions.closeOutcomeDialog();
    setSelection('');
    setNote('');
    setSelectionError(undefined);
  };

  const handleConfirm = () => {
    if (!selection) {
      setSelectionError(t('adminWorkflowQvcOutcomeRequiredError'));
      return;
    }
    setSelectionError(undefined);
    const noShow = selection === 'no_show';
    actions.submitOutcome(noShow ? undefined : selection, noShow, currentStageCode, note.trim() || undefined);
  };

  return (
    <ConfirmDialog
      open={Boolean(actions.outcomeAttemptId)}
      onOpenChange={handleOpenChange}
      title={t('adminWorkflowQvcOutcomeDialogTitle')}
      description={
        attempt
          ? `${t('adminWorkflowQvcOutcomeDialogDescription')} (${t('adminWorkflowQvcAttemptPrefix')} ${attempt.attemptNumber})`
          : t('adminWorkflowQvcOutcomeDialogDescription')
      }
      confirmLabel={t('adminWorkflowQvcOutcomeConfirmAction')}
      cancelLabel={t('adminWorkflowCancelAction')}
      closeLabel={t('dsClose')}
      onConfirm={handleConfirm}
      isConfirming={actions.outcomeMutation.isPending}
    >
      <div className="space-y-4">
        <Select
          label={t('adminWorkflowQvcOutcomeLabel')}
          value={selection}
          onChange={(event) => setSelection(event.target.value as QvcOutcomeCode | 'no_show' | '')}
          errorMessage={selectionError}
          options={[
            { value: '', label: '' },
            ...QVC_OUTCOME_SELECT_VALUES.map((value) => ({
              value,
              label: t(QVC_ATTEMPT_STATUS_KEYS[value] as TranslationKey),
            })),
          ]}
        />
        <Textarea label={t('adminWorkflowQvcNoteLabel')} value={note} onChange={(event) => setNote(event.target.value)} rows={2} />
        {conflictMessage ? <ValidationMessage tone="error">{conflictMessage}</ValidationMessage> : null}
        {generalError ? <ValidationMessage tone="error">{generalError}</ValidationMessage> : null}
      </div>
    </ConfirmDialog>
  );
}

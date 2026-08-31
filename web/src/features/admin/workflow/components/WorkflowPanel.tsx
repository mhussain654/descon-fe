import { useEffect, useState } from 'react';
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
  Input,
  LoadingState,
  OfflineState,
  ValidationMessage,
} from '../../../../design-system';
import { formatDate } from '../../../../../../shared/i18n/locale';
import { ADMIN_WORKFLOW_ERROR_KEYS } from '../../../../../../shared/adminWorkflow/errorMessages';
import { toWorkflowBlockingReason, WORKFLOW_BLOCKING_REASON_KEYS } from '../../../../../../shared/adminWorkflow/blockingReasons';
import type { AdminWorkflowError, AllowedWorkflowTransition, WorkflowHistoryItem } from '../../../../../../shared/adminWorkflow/types';
import { ADMIN_REVIEWER_ROLE_KEYS } from '../../../../../../shared/adminDocumentReviews/statusLabels';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import { useAvailableTransitions } from '../hooks/useAvailableTransitions';
import { useQvcActions } from '../hooks/useQvcActions';
import { useQvcAttempts } from '../hooks/useQvcAttempts';
import { useSubmitWorkflowTransition } from '../hooks/useSubmitWorkflowTransition';
import { useWorkflowHistory } from '../hooks/useWorkflowHistory';
import { useWorkflowState } from '../hooks/useWorkflowState';
import { QvcPanel } from './QvcPanel';

export interface WorkflowPanelProps {
  candidateId: string;
}

/** Stage codes with a real, interactive confirmation card in this build. Every other returned transition renders as a plain, non-interactive row. */
const QATAR_BU_STAGE_CODE = 'documents_shared_with_qatar_bu';
/** QVC's own two stage-transition codes are handled entirely by the dedicated QvcPanel (its own POST/PATCH .../qvc_attempts endpoints), not by the generic allowedNextTransitions confirm flow -- excluded from the generic list below so they aren't also shown as an inert "coming soon" row. */
const QVC_STAGE_CODES = new Set(['qvc_appointment_booked', 'qvc_completed_outcome_received']);
const PROTECTION_APPEARED_STAGE_CODE = 'appeared_for_protection';
const PROTECTION_READY_STAGE_CODE = 'protected_ready_to_fly';
const PROTECTION_STAGE_CODES = new Set([PROTECTION_APPEARED_STAGE_CODE, PROTECTION_READY_STAGE_CODE]);

/** Translation keys for a timeline stage's status -- reuses existing generic keys rather than duplicating them, since a raw backend status code must never render untranslated. */
const STAGE_STATUS_KEYS: Record<string, TranslationKey> = {
  completed: 'workflowStageCompletedPrefix',
  current: 'inProgress',
  pending: 'pending',
};

function stageStatusTone(status: string): 'neutral' | 'success' | 'info' {
  if (status === 'completed') return 'success';
  if (status === 'current') return 'info';
  return 'neutral';
}

/**
 * Shared staff workflow-transition panel foundation (MPS-F501 Phase A/B).
 * Loads real workflow state/available-transitions/history for one
 * candidate, plus (Phase B) real QVC attempts and the candidate's
 * protection record. Renders real, interactive confirmation cards for
 * Qatar BU sharing, protection appearance and ready-to-fly, and a dedicated
 * QVC scheduling/outcome sub-panel. Visa/flight/mobilization forms remain
 * out of scope until their own backend contracts (MPS-505/MPS-507) merge --
 * every other transition the backend returns still renders as a plain
 * informational row with no action.
 */
export function WorkflowPanel({ candidateId }: WorkflowPanelProps) {
  const { t, language } = useLanguage();
  const { hasPermission, signOut } = useStaffAuth();
  const canTransition = hasPermission('manage_workflow');

  const stateQuery = useWorkflowState(candidateId);
  const transitionsQuery = useAvailableTransitions(candidateId);
  const historyQuery = useWorkflowHistory(candidateId);
  const submit = useSubmitWorkflowTransition(candidateId);
  const qvcAttemptsQuery = useQvcAttempts(candidateId);
  const qvcActions = useQvcActions(candidateId);

  const refetchAll = () => {
    stateQuery.refetch();
    transitionsQuery.refetch();
    historyQuery.refetch();
    qvcAttemptsQuery.refetch();
  };

  // A confirmed-dead session or a deactivated account can surface from any
  // of the read queries or either mutation family -- not only one of them
  // (mirrors SubmissionDetail.tsx's identical rationale: "Session errors
  // from preview and review mutations do not end the session").
  useEffect(() => {
    const code =
      stateQuery.error?.code ??
      transitionsQuery.error?.code ??
      historyQuery.error?.code ??
      submit.mutation.error?.code ??
      qvcAttemptsQuery.error?.code ??
      qvcActions.scheduleMutation.error?.code ??
      qvcActions.outcomeMutation.error?.code;
    if (code === 'SESSION_EXPIRED' || code === 'INACTIVE_ACCOUNT') {
      submit.closeConfirm();
      signOut(code === 'SESSION_EXPIRED' ? 'expired' : 'manual');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    stateQuery.error,
    transitionsQuery.error,
    historyQuery.error,
    submit.mutation.error,
    qvcAttemptsQuery.error,
    qvcActions.scheduleMutation.error,
    qvcActions.outcomeMutation.error,
    signOut,
  ]);

  const isLoading = stateQuery.isLoading || transitionsQuery.isLoading || historyQuery.isLoading;

  // A session-ending error from *any* of the three queries must win over a
  // merely transient error from another -- same source-priority bug class
  // fixed on the candidate Dashboard during MPS-F302; fixed here from the
  // start rather than repeating it.
  const errorSources = [stateQuery.error, transitionsQuery.error, historyQuery.error];
  const sessionEndingError = errorSources.find((e) => e?.code === 'SESSION_EXPIRED' || e?.code === 'INACTIVE_ACCOUNT');
  const primaryError: AdminWorkflowError | null | undefined = sessionEndingError ?? errorSources.find((e) => e);

  if (isLoading) {
    return <LoadingState message={t('loading')} />;
  }
  if (primaryError?.code === 'SESSION_EXPIRED' || primaryError?.code === 'INACTIVE_ACCOUNT') {
    // The effect above already signs the staff member out -- nothing to
    // render here in the meantime.
    return null;
  }
  if (primaryError?.code === 'FORBIDDEN') {
    return <ForbiddenState title={t('dsForbiddenTitle')} description={t('staffAuthForbiddenError')} />;
  }
  if (primaryError?.code === 'OFFLINE') {
    return (
      <OfflineState title={t('dsOfflineTitle')} description={t('dsOfflineDescription')} retryLabel={t('retry')} onRetry={refetchAll} />
    );
  }
  if (primaryError) {
    const messageKey = ADMIN_WORKFLOW_ERROR_KEYS[primaryError.code] as TranslationKey;
    return <ErrorState message={primaryError.message || t(messageKey)} retryLabel={t('retry')} onRetry={refetchAll} />;
  }

  const state = stateQuery.data;
  const transitions = transitionsQuery.data;
  const history = historyQuery.data;
  if (!state || !transitions || !history) {
    return <ErrorState message={t('somethingWentWrong')} retryLabel={t('retry')} onRetry={refetchAll} />;
  }

  const qatarBuTransition = transitions.allowedNextTransitions.find((item) => item.code === QATAR_BU_STAGE_CODE);
  const protectionAppearedTransition = transitions.allowedNextTransitions.find(
    (item) => item.code === PROTECTION_APPEARED_STAGE_CODE
  );
  const protectionReadyTransition = transitions.allowedNextTransitions.find(
    (item) => item.code === PROTECTION_READY_STAGE_CODE
  );
  const otherTransitions = transitions.allowedNextTransitions.filter(
    (item) => item.code !== QATAR_BU_STAGE_CODE && !QVC_STAGE_CODES.has(item.code) && !PROTECTION_STAGE_CODES.has(item.code)
  );
  const latestTransition = history.history.reduce<WorkflowHistoryItem | null>(
    (latest, item) => (!latest || item.occurredAt > latest.occurredAt ? item : latest),
    null
  );

  const mutationError = submit.mutation.error;
  const conflictMessage =
    mutationError?.code === 'IDEMPOTENCY_CONFLICT'
      ? mutationError.message || t(ADMIN_WORKFLOW_ERROR_KEYS.IDEMPOTENCY_CONFLICT as TranslationKey)
      : undefined;
  const nonFieldMutationError =
    mutationError && !conflictMessage && mutationError.code !== 'WORKFLOW_TRANSITION_STALE' && mutationError.code !== 'WORKFLOW_TRANSITION_PREREQUISITE_MISSING'
      ? mutationError.message || t(ADMIN_WORKFLOW_ERROR_KEYS[mutationError.code] as TranslationKey)
      : undefined;

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold text-text-primary">{t('adminWorkflowPanelTitle')}</h2>

      {/* Current stage summary */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-sunken p-4">
        <div>
          <div className="text-xs text-text-tertiary">{t('adminWorkflowCurrentStageLabel')}</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-medium text-text-primary">{state.currentStage?.name ?? t('adminWorkflowNoCurrentStage')}</span>
            {state.currentStage ? (
              <Badge tone={stageStatusTone(state.currentStage.status)}>
                {t(STAGE_STATUS_KEYS[state.currentStage.status] ?? STAGE_STATUS_KEYS.pending)}
              </Badge>
            ) : null}
          </div>
          {latestTransition ? (
            <div className="mt-2 text-xs text-text-tertiary">
              {t('adminWorkflowLastTransitionPrefix')}{' '}
              {latestTransition.actor ? t(ADMIN_REVIEWER_ROLE_KEYS[latestTransition.actor.role] as TranslationKey) : t('adminWorkflowUnknownActor')}
              {' • '}
              {formatDate(latestTransition.occurredAt, language, { dateStyle: 'medium', timeStyle: 'short' })}
            </div>
          ) : null}
        </div>
        <div className="text-end">
          <div className="text-xs text-text-tertiary">{t('adminWorkflowProgressLabel')}</div>
          <div className="text-lg font-semibold text-text-primary">
            {state.completedCount}/{state.totalCount}
          </div>
        </div>
      </div>

      {/* Available transitions */}
      <h3 className="mb-3 text-sm font-semibold text-text-primary">{t('adminWorkflowAvailableTransitionsTitle')}</h3>
      {transitions.allowedNextTransitions.length === 0 ? (
        <EmptyState title={t('adminWorkflowNoTransitionsTitle')} description={t('adminWorkflowNoTransitionsDescription')} />
      ) : (
        <div className="space-y-3">
          {qatarBuTransition ? (
            <QatarBuTransitionCard
              transition={qatarBuTransition}
              canTransition={canTransition}
              currentStageCode={state.currentStage?.code}
              onConfirm={() => submit.openConfirm(QATAR_BU_STAGE_CODE)}
            />
          ) : null}
          {protectionAppearedTransition ? (
            <ProtectionTransitionCard
              transition={protectionAppearedTransition}
              canTransition={canTransition}
              descriptionKey="adminWorkflowProtectionAppearedDescription"
              actionLabelKey="adminWorkflowProtectionAppearedConfirmAction"
              requiredEvidenceField="appeared_for_protection_on"
              onConfirm={() => submit.openConfirm(PROTECTION_APPEARED_STAGE_CODE)}
            />
          ) : null}
          {protectionReadyTransition ? (
            <ProtectionTransitionCard
              transition={protectionReadyTransition}
              canTransition={canTransition}
              descriptionKey="adminWorkflowProtectionReadyDescription"
              actionLabelKey="adminWorkflowProtectionReadyConfirmAction"
              requiredEvidenceField="protected_on"
              onConfirm={() => submit.openConfirm(PROTECTION_READY_STAGE_CODE)}
            />
          ) : null}
          {otherTransitions.map((item) => (
            <OtherTransitionRow key={item.code} transition={item} />
          ))}
        </div>
      )}

      {submit.staleNotice ? (
        <div className="mt-4">
          <ValidationMessage tone="error">{t('adminWorkflowStaleNoticeMessage')}</ValidationMessage>
        </div>
      ) : null}

      <QvcPanel
        canTransition={canTransition}
        attemptsQuery={qvcAttemptsQuery}
        actions={qvcActions}
        currentStageCode={state.currentStage?.code}
      />

      {/* Protection details */}
      <div className="mt-6 border-t border-border pt-6">
        <h3 className="mb-3 text-sm font-semibold text-text-primary">{t('adminWorkflowProtectionDetailsTitle')}</h3>
        {state.protection?.appearedOn || state.protection?.protectedOn ? (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {state.protection.appearedOn ? (
              <div>
                <dt className="text-xs text-text-tertiary">{t('adminWorkflowProtectionAppearedOnLabel')}</dt>
                <dd className="text-text-primary">{formatDate(state.protection.appearedOn, language, { dateStyle: 'medium' })}</dd>
              </div>
            ) : null}
            {state.protection.protectedOn ? (
              <div>
                <dt className="text-xs text-text-tertiary">{t('adminWorkflowProtectionProtectedOnLabel')}</dt>
                <dd className="text-text-primary">{formatDate(state.protection.protectedOn, language, { dateStyle: 'medium' })}</dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="text-sm text-text-secondary">{t('adminWorkflowProtectionNoDetails')}</p>
        )}
      </div>

      {/* History */}
      <h3 className="mb-3 mt-6 text-sm font-semibold text-text-primary">{t('adminWorkflowHistoryTitle')}</h3>
      {history.history.length === 0 ? (
        <p className="text-sm text-text-secondary">{t('adminWorkflowHistoryEmpty')}</p>
      ) : (
        <ul className="space-y-2">
          {history.history.map((item, index) => (
            <li key={`${item.toStage.code}-${item.occurredAt}-${index}`} className="rounded-lg border border-border p-3 text-sm">
              <div className="font-medium text-text-primary">
                {item.fromStage ? `${item.fromStage.name} → ${item.toStage.name}` : item.toStage.name}
              </div>
              <div className="mt-1 text-xs text-text-tertiary">
                {item.actor ? t(ADMIN_REVIEWER_ROLE_KEYS[item.actor.role] as TranslationKey) : t('adminWorkflowUnknownActor')}
                {' • '}
                {formatDate(item.occurredAt, language, { dateStyle: 'medium', timeStyle: 'short' })}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={submit.pendingToStageCode === QATAR_BU_STAGE_CODE}
        onOpenChange={(open) => (!open ? submit.closeConfirm() : undefined)}
        title={t('adminWorkflowQatarBuConfirmTitle')}
        description={t('adminWorkflowQatarBuConfirmDescription')}
        confirmLabel={t('adminWorkflowQatarBuConfirmAction')}
        cancelLabel={t('adminWorkflowCancelAction')}
        closeLabel={t('dsClose')}
        onConfirm={() => submit.confirm(state.currentStage?.code)}
        isConfirming={submit.mutation.isPending}
      >
        {conflictMessage ? <ValidationMessage tone="error">{conflictMessage}</ValidationMessage> : null}
        {nonFieldMutationError ? <ValidationMessage tone="error">{nonFieldMutationError}</ValidationMessage> : null}
      </ConfirmDialog>

      <ProtectionConfirmDialog
        submit={submit}
        currentStageCode={state.currentStage?.code}
        conflictMessage={conflictMessage}
        nonFieldMutationError={nonFieldMutationError}
      />
    </Card>
  );
}

interface ProtectionConfirmDialogProps {
  submit: ReturnType<typeof useSubmitWorkflowTransition>;
  currentStageCode: string | undefined;
  conflictMessage: string | undefined;
  nonFieldMutationError: string | undefined;
}

/**
 * One dialog serves both protection transitions -- appeared-for-protection
 * and protected/ready-to-fly -- since they're mutually exclusive (strictly
 * sequential stages, so at most one is ever the "next" available
 * transition) and share the same single-date-field shape, differing only in
 * copy and which evidence field name the date is sent as.
 */
function ProtectionConfirmDialog({
  submit,
  currentStageCode,
  conflictMessage,
  nonFieldMutationError,
}: ProtectionConfirmDialogProps) {
  const { t } = useLanguage();
  const [date, setDate] = useState('');
  const [dateError, setDateError] = useState<string | undefined>(undefined);

  const isAppeared = submit.pendingToStageCode === PROTECTION_APPEARED_STAGE_CODE;
  const isReady = submit.pendingToStageCode === PROTECTION_READY_STAGE_CODE;
  const open = isAppeared || isReady;

  const evidenceFieldName = isReady ? 'protected_on' : 'appeared_for_protection_on';
  const dialogTitle = isReady ? t('adminWorkflowProtectionReadyConfirmTitle') : t('adminWorkflowProtectionAppearedConfirmTitle');
  const dialogDescription = isReady
    ? t('adminWorkflowProtectionReadyConfirmDescription')
    : t('adminWorkflowProtectionAppearedConfirmDescription');
  const dateLabel = isReady ? t('adminWorkflowProtectionDateLabel') : t('adminWorkflowProtectionAppearedDateLabel');
  const confirmLabel = isReady ? t('adminWorkflowProtectionReadyConfirmAction') : t('adminWorkflowProtectionAppearedConfirmAction');

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) return;
    submit.closeConfirm();
    setDate('');
    setDateError(undefined);
  };

  const handleConfirm = () => {
    if (!date) {
      setDateError(t('adminWorkflowProtectionDateRequiredError'));
      return;
    }
    setDateError(undefined);
    submit.confirm(currentStageCode, { [evidenceFieldName]: date });
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={dialogTitle}
      description={dialogDescription}
      confirmLabel={confirmLabel}
      cancelLabel={t('adminWorkflowCancelAction')}
      closeLabel={t('dsClose')}
      onConfirm={handleConfirm}
      isConfirming={submit.mutation.isPending}
    >
      <div className="space-y-4">
        <Input type="date" label={dateLabel} value={date} onChange={(event) => setDate(event.target.value)} errorMessage={dateError} />
        {conflictMessage ? <ValidationMessage tone="error">{conflictMessage}</ValidationMessage> : null}
        {nonFieldMutationError ? <ValidationMessage tone="error">{nonFieldMutationError}</ValidationMessage> : null}
      </div>
    </ConfirmDialog>
  );
}

interface QatarBuTransitionCardProps {
  transition: AllowedWorkflowTransition;
  canTransition: boolean;
  currentStageCode: string | undefined;
  onConfirm: () => void;
}

/**
 * The one real, interactive transition confirmation in Phase A. Appears
 * only because `documents_shared_with_qatar_bu` was returned as an
 * available transition -- never inferred from any frontend document/
 * payment value (ticket: "Never infer eligibility solely from frontend
 * document/payment values. The backend response is authoritative.").
 */
function QatarBuTransitionCard({ transition, canTransition, onConfirm }: QatarBuTransitionCardProps) {
  const { t } = useLanguage();

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-medium text-text-primary">{transition.name}</div>
          <p className="mt-1 text-sm text-text-secondary">{t('adminWorkflowQatarBuDescription')}</p>
        </div>
        {transition.allowed && canTransition ? (
          <Button type="button" onClick={onConfirm}>
            {t('adminWorkflowQatarBuConfirmAction')}
          </Button>
        ) : null}
      </div>
      {!transition.allowed && transition.blockingReasons.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {transition.blockingReasons.map((reason) => (
            <li key={reason}>
              <ValidationMessage tone="error">
                {t(WORKFLOW_BLOCKING_REASON_KEYS[toWorkflowBlockingReason(reason)] as TranslationKey)}
              </ValidationMessage>
            </li>
          ))}
        </ul>
      ) : null}
      {transition.allowed && !canTransition ? (
        <p className="mt-3 text-xs text-text-tertiary">{t('adminWorkflowViewOnlyNotice')}</p>
      ) : null}
    </div>
  );
}

interface ProtectionTransitionCardProps {
  transition: AllowedWorkflowTransition;
  canTransition: boolean;
  descriptionKey: TranslationKey;
  actionLabelKey: TranslationKey;
  /** The evidence field this card's own dialog collects (e.g. `appeared_for_protection_on`). */
  requiredEvidenceField: string;
  onConfirm: () => void;
}

/**
 * Shared card shape for both protection stage transitions -- appears only
 * because the backend actually returned this stage code as available
 * (never inferred from any frontend value), same rule as QatarBuTransitionCard.
 *
 * `allowed_next_transitions` evaluates every stage's prerequisites using
 * *empty* evidence (it has no request-scoped evidence to check against), so
 * a stage that requires a field this card's own dialog collects always
 * comes back `allowed: false` with a single `<field>_required` blocking
 * reason -- confirmed live against the real backend. That is not a real
 * prerequisite failure; it is simply "provide the evidence," which is
 * exactly what the dialog is for. Only a blocking reason *other* than the
 * card's own required field (e.g. `qvc_approval_required`, `visa_issued_required`)
 * represents a genuine block that should hide the action and list the reason.
 */
function ProtectionTransitionCard({
  transition,
  canTransition,
  descriptionKey,
  actionLabelKey,
  requiredEvidenceField,
  onConfirm,
}: ProtectionTransitionCardProps) {
  const { t } = useLanguage();

  const ownEvidenceReason = `${requiredEvidenceField}_required`;
  const blockedOnlyByOwnEvidence =
    !transition.allowed && transition.blockingReasons.length > 0 && transition.blockingReasons.every((reason) => reason === ownEvidenceReason);
  const canAttempt = transition.allowed || blockedOnlyByOwnEvidence;
  const genuinelyBlocked = !transition.allowed && !blockedOnlyByOwnEvidence && transition.blockingReasons.length > 0;

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-medium text-text-primary">{transition.name}</div>
          <p className="mt-1 text-sm text-text-secondary">{t(descriptionKey)}</p>
        </div>
        {canAttempt && canTransition ? (
          <Button type="button" onClick={onConfirm}>
            {t(actionLabelKey)}
          </Button>
        ) : null}
      </div>
      {genuinelyBlocked ? (
        <ul className="mt-3 space-y-1">
          {transition.blockingReasons.map((reason) => (
            <li key={reason}>
              <ValidationMessage tone="error">
                {t(WORKFLOW_BLOCKING_REASON_KEYS[toWorkflowBlockingReason(reason)] as TranslationKey)}
              </ValidationMessage>
            </li>
          ))}
        </ul>
      ) : null}
      {canAttempt && !canTransition ? (
        <p className="mt-3 text-xs text-text-tertiary">{t('adminWorkflowViewOnlyNotice')}</p>
      ) : null}
    </div>
  );
}

/** Every remaining transition the backend returns (visa/flight/mobilization -- no merged, verified backend contract yet) -- read-only until MPS-505/MPS-507 merge. */
function OtherTransitionRow({ transition }: { transition: AllowedWorkflowTransition }) {
  const { t } = useLanguage();

  return (
    <div className="rounded-lg border border-border p-4 opacity-75">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-text-primary">{transition.name}</span>
        <Badge tone="neutral">{t('adminWorkflowComingSoonBadge')}</Badge>
      </div>
      {!transition.allowed && transition.blockingReasons.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {transition.blockingReasons.map((reason) => (
            <li key={reason} className="text-xs text-text-tertiary">
              {t(WORKFLOW_BLOCKING_REASON_KEYS[toWorkflowBlockingReason(reason)] as TranslationKey)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

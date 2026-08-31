import { useEffect } from 'react';
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
  ValidationMessage,
} from '../../../../design-system';
import { formatDate } from '../../../../../../shared/i18n/locale';
import { ADMIN_WORKFLOW_ERROR_KEYS } from '../../../../../../shared/adminWorkflow/errorMessages';
import { toWorkflowBlockingReason, WORKFLOW_BLOCKING_REASON_KEYS } from '../../../../../../shared/adminWorkflow/blockingReasons';
import type { AdminWorkflowError, AllowedWorkflowTransition, WorkflowHistoryItem } from '../../../../../../shared/adminWorkflow/types';
import { ADMIN_REVIEWER_ROLE_KEYS } from '../../../../../../shared/adminDocumentReviews/statusLabels';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import { useAvailableTransitions } from '../hooks/useAvailableTransitions';
import { useSubmitWorkflowTransition } from '../hooks/useSubmitWorkflowTransition';
import { useWorkflowHistory } from '../hooks/useWorkflowHistory';
import { useWorkflowState } from '../hooks/useWorkflowState';

export interface WorkflowPanelProps {
  candidateId: string;
}

/** Stage codes with a real, interactive confirmation card in this build. Every other returned transition renders as a plain, non-interactive row -- see the QVC/protection exclusion note below. */
const QATAR_BU_STAGE_CODE = 'documents_shared_with_qatar_bu';

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
 * Shared staff workflow-transition panel foundation (MPS-F501 Phase A).
 * Loads real workflow state/available-transitions/history for one
 * candidate, and renders one real, interactive confirmation card today --
 * the Qatar BU sharing transition. Every other transition the backend
 * returns (QVC appointment/outcome, protection appearance, protected/
 * ready-to-fly -- none of which have a merged, verified backend contract
 * yet) renders as a plain informational row with no action, so this panel
 * never invents a payload for them (ticket: "Do not invent the QVC or
 * protection payload before that backend contract is merged."). Adding a
 * real card for one of those later means adding another branch here, not
 * rebuilding this foundation.
 */
export function WorkflowPanel({ candidateId }: WorkflowPanelProps) {
  const { t, language } = useLanguage();
  const { hasPermission, signOut } = useStaffAuth();
  const canTransition = hasPermission('manage_workflow');

  const stateQuery = useWorkflowState(candidateId);
  const transitionsQuery = useAvailableTransitions(candidateId);
  const historyQuery = useWorkflowHistory(candidateId);
  const submit = useSubmitWorkflowTransition(candidateId);

  const refetchAll = () => {
    stateQuery.refetch();
    transitionsQuery.refetch();
    historyQuery.refetch();
  };

  // A confirmed-dead session or a deactivated account can surface from any
  // of the three read queries or the transition mutation itself -- not only
  // one of them (mirrors SubmissionDetail.tsx's identical rationale: "Session
  // errors from preview and review mutations do not end the session").
  useEffect(() => {
    const code =
      stateQuery.error?.code ?? transitionsQuery.error?.code ?? historyQuery.error?.code ?? submit.mutation.error?.code;
    if (code === 'SESSION_EXPIRED' || code === 'INACTIVE_ACCOUNT') {
      submit.closeConfirm();
      signOut(code === 'SESSION_EXPIRED' ? 'expired' : 'manual');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateQuery.error, transitionsQuery.error, historyQuery.error, submit.mutation.error, signOut]);

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
  const otherTransitions = transitions.allowedNextTransitions.filter((item) => item.code !== QATAR_BU_STAGE_CODE);
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
    </Card>
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

/** Every non-Qatar-BU transition the backend returns -- read-only until its own backend contract (MPS-504/MPS-506) is merged and verified. */
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

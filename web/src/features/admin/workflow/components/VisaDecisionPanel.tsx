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
import { toWorkflowBlockingReason, WORKFLOW_BLOCKING_REASON_KEYS } from '../../../../../../shared/adminWorkflow/blockingReasons';
import { VISA_REJECTION_REASON_KEYS, VISA_REJECTION_REASON_SELECT_VALUES } from '../../../../../../shared/adminWorkflow/visaRejectionReasonLabels';
import type { AdminVisaDecision, AllowedWorkflowTransition, VisaOutcomeCode, VisaRejectionReasonCode } from '../../../../../../shared/adminWorkflow/types';
import { ADMIN_REVIEWER_ROLE_KEYS } from '../../../../../../shared/adminDocumentReviews/statusLabels';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import { resolveDocumentAccessUrl } from '../../../../lib/resolveDocumentAccessUrl';
import { blockedOnlyByEvidenceFields } from '../blockedByOwnEvidence';
import type { useVisaActions } from '../hooks/useVisaActions';
import type { useVisaDecisions } from '../hooks/useVisaDecisions';
import { WorkflowFileField } from './WorkflowFileField';

/**
 * `visa_issued_or_rejected`'s unconditionally-required evidence fields, per
 * the real backend's StageRequirements (confirmed live against the running
 * API, not assumed) -- these are the *internal* evidence keys the
 * allowed-transitions endpoint's blocking reasons use
 * (`visa_outcome_code_required` / `visa_outcome_date_required`), which
 * differ from the visa-decision controller's own public request field names
 * (`outcome_code` / `decision_date`, used by useVisaActions.ts's FormData).
 * rejection_reason_code is conditionally required only when outcome_code is
 * rejected, and is never listed as a static required field.
 */
const VISA_REQUIRED_EVIDENCE_FIELDS = ['visa_outcome_code', 'visa_outcome_date'];

export interface VisaDecisionPanelProps {
  canTransition: boolean;
  visaTransition: AllowedWorkflowTransition | undefined;
  decisionsQuery: ReturnType<typeof useVisaDecisions>;
  actions: ReturnType<typeof useVisaActions>;
  currentStageCode: string | undefined;
}

function outcomeTone(outcome: VisaOutcomeCode): 'success' | 'danger' {
  return outcome === 'issued' ? 'success' : 'danger';
}

/**
 * Staff visa-decision panel -- issued/rejected recording, structured
 * rejection reasons, and short-lived visa-copy access (MPS-F501 Phase C).
 * The action buttons appear only while `visaTransition` is actually the
 * backend's next available transition; once the workflow has moved past
 * `visa_issued_or_rejected`, the transition stops appearing in the allowed-
 * transitions list entirely, so this panel naturally becomes read-only
 * without any extra "is this final" check (same mechanism the ticket's
 * "Do not allow editing after the workflow/backend says the decision is
 * final" requirement relies on).
 */
export function VisaDecisionPanel({ canTransition, visaTransition, decisionsQuery, actions, currentStageCode }: VisaDecisionPanelProps) {
  const { t } = useLanguage();

  const canAttempt = visaTransition
    ? visaTransition.allowed || blockedOnlyByEvidenceFields(visaTransition, VISA_REQUIRED_EVIDENCE_FIELDS)
    : false;
  const genuinelyBlocked = !!visaTransition && !visaTransition.allowed && !canAttempt && visaTransition.blockingReasons.length > 0;

  return (
    <div className="mt-6 border-t border-border pt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-text-primary">{t('adminWorkflowVisaPanelTitle')}</h3>
        {canAttempt && canTransition ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => actions.openRecordDialog('issued')}>
              {t('adminWorkflowVisaIssuedAction')}
            </Button>
            <Button type="button" variant="outline" onClick={() => actions.openRecordDialog('rejected')}>
              {t('adminWorkflowVisaRejectedAction')}
            </Button>
          </div>
        ) : null}
      </div>

      {genuinelyBlocked ? (
        <ul className="mb-3 space-y-1">
          {visaTransition!.blockingReasons.map((reason) => (
            <li key={reason}>
              <ValidationMessage tone="error">
                {t(WORKFLOW_BLOCKING_REASON_KEYS[toWorkflowBlockingReason(reason)] as TranslationKey)}
              </ValidationMessage>
            </li>
          ))}
        </ul>
      ) : null}
      {canAttempt && !canTransition ? <p className="mb-3 text-xs text-text-tertiary">{t('adminWorkflowViewOnlyNotice')}</p> : null}

      <VisaDecisionsBody decisionsQuery={decisionsQuery} actions={actions} />

      {actions.staleNotice ? (
        <div className="mt-3">
          <ValidationMessage tone="error">{t('adminWorkflowStaleNoticeMessage')}</ValidationMessage>
        </div>
      ) : null}

      <RecordVisaDecisionDialog actions={actions} currentStageCode={currentStageCode} />
    </div>
  );
}

function VisaDecisionsBody({
  decisionsQuery,
  actions,
}: {
  decisionsQuery: ReturnType<typeof useVisaDecisions>;
  actions: ReturnType<typeof useVisaActions>;
}) {
  const { t } = useLanguage();

  if (decisionsQuery.isLoading) {
    return <LoadingState message={t('loading')} />;
  }
  if (decisionsQuery.error?.code === 'OFFLINE') {
    return (
      <OfflineState
        title={t('dsOfflineTitle')}
        description={t('dsOfflineDescription')}
        retryLabel={t('retry')}
        onRetry={() => decisionsQuery.refetch()}
      />
    );
  }
  if (decisionsQuery.error) {
    const messageKey = ADMIN_WORKFLOW_ERROR_KEYS[decisionsQuery.error.code] as TranslationKey;
    return (
      <ErrorState
        message={decisionsQuery.error.message || t(messageKey)}
        retryLabel={t('retry')}
        onRetry={() => decisionsQuery.refetch()}
      />
    );
  }

  const decisions = decisionsQuery.data?.visaDecisions ?? [];
  if (decisions.length === 0) {
    return <p className="text-sm text-text-secondary">{t('adminWorkflowVisaDecisionsEmpty')}</p>;
  }

  return (
    <ul className="space-y-2">
      {decisions.map((decision) => (
        <VisaDecisionRow key={decision.id} decision={decision} actions={actions} />
      ))}
    </ul>
  );
}

function VisaDecisionRow({ decision, actions }: { decision: AdminVisaDecision; actions: ReturnType<typeof useVisaActions> }) {
  const { t, language } = useLanguage();
  const isThisAccess = actions.copyAccess.access?.visaDecisionId === decision.id;

  return (
    <li className="rounded-lg border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-medium text-text-primary">{formatDate(decision.decisionDate, language, { dateStyle: 'medium' })}</div>
        <Badge tone={outcomeTone(decision.outcomeCode)}>
          {t(decision.outcomeCode === 'issued' ? 'adminWorkflowVisaOutcomeIssued' : 'adminWorkflowVisaOutcomeRejected')}
        </Badge>
      </div>
      {decision.outcomeCode === 'rejected' && decision.rejectionReasonCode ? (
        <p className="mt-1 text-xs text-text-tertiary">{t(VISA_REJECTION_REASON_KEYS[decision.rejectionReasonCode] as TranslationKey)}</p>
      ) : null}
      <div className="mt-1 text-xs text-text-tertiary">
        {t('adminWorkflowRecordedByPrefix')}{' '}
        {decision.recordedBy ? t(ADMIN_REVIEWER_ROLE_KEYS[decision.recordedBy.role] as TranslationKey) : t('adminWorkflowUnknownActor')}
      </div>
      {decision.outcomeCode === 'issued' && decision.visaCopyAttached ? (
        <div className="mt-2">
          {isThisAccess && actions.copyAccess.access && !actions.copyAccess.isExpired ? (
            <a
              href={resolveDocumentAccessUrl(actions.copyAccess.access.url, import.meta.env.VITE_API_BASE_URL ?? '')}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-brand-primary underline"
            >
              {t('adminWorkflowVisaOpenCopyAction')}
            </a>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => actions.requestCopyAccess(decision.id)}
              disabled={actions.copyAccess.isRequesting}
            >
              {t('adminWorkflowVisaViewCopyAction')}
            </Button>
          )}
          {isThisAccess && actions.copyAccess.isExpired ? (
            <p className="mt-1 text-xs text-text-tertiary">{t('adminWorkflowAccessExpiredMessage')}</p>
          ) : null}
          {isThisAccess && actions.copyAccess.error ? (
            <ValidationMessage tone="error">
              {actions.copyAccess.error.message || t(ADMIN_WORKFLOW_ERROR_KEYS[actions.copyAccess.error.code] as TranslationKey)}
            </ValidationMessage>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function RecordVisaDecisionDialog({
  actions,
  currentStageCode,
}: {
  actions: ReturnType<typeof useVisaActions>;
  currentStageCode: string | undefined;
}) {
  const { t } = useLanguage();
  const [note, setNote] = useState('');
  const [dateError, setDateError] = useState<string | undefined>(undefined);
  const [reasonError, setReasonError] = useState<string | undefined>(undefined);

  const isIssued = actions.recordingOutcome === 'issued';
  const isRejected = actions.recordingOutcome === 'rejected';
  const open = isIssued || isRejected;

  const mutationError = actions.mutation.error;
  const conflictMessage =
    mutationError?.code === 'IDEMPOTENCY_CONFLICT'
      ? mutationError.message || t(ADMIN_WORKFLOW_ERROR_KEYS.IDEMPOTENCY_CONFLICT as TranslationKey)
      : undefined;
  const generalError =
    mutationError && !conflictMessage
      ? mutationError.message || t(ADMIN_WORKFLOW_ERROR_KEYS[mutationError.code] as TranslationKey)
      : undefined;

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) return;
    actions.closeRecordDialog();
    setNote('');
    setDateError(undefined);
    setReasonError(undefined);
  };

  const handleConfirm = () => {
    let hasError = false;
    if (!actions.decisionDate) {
      setDateError(t('adminWorkflowVisaDecisionDateRequiredError'));
      hasError = true;
    } else {
      setDateError(undefined);
    }
    if (isRejected && !actions.rejectionReasonCode) {
      setReasonError(t('adminWorkflowVisaRejectionReasonRequiredError'));
      hasError = true;
    } else {
      setReasonError(undefined);
    }
    if (hasError) return;
    actions.submit(currentStageCode, note.trim() || undefined);
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={isRejected ? t('adminWorkflowVisaRejectedDialogTitle') : t('adminWorkflowVisaIssuedDialogTitle')}
      description={isRejected ? t('adminWorkflowVisaRejectedDialogDescription') : t('adminWorkflowVisaIssuedDialogDescription')}
      confirmLabel={t('adminWorkflowVisaConfirmAction')}
      cancelLabel={t('adminWorkflowCancelAction')}
      closeLabel={t('dsClose')}
      onConfirm={handleConfirm}
      isConfirming={actions.mutation.isPending}
    >
      <div className="space-y-4">
        <Input
          type="date"
          label={t('adminWorkflowVisaDecisionDateLabel')}
          value={actions.decisionDate}
          onChange={(event) => actions.setDecisionDate(event.target.value)}
          errorMessage={dateError}
        />
        {isIssued ? (
          <WorkflowFileField
            file={actions.visaCopy}
            error={actions.fileError ? t('adminWorkflowVisaCopyRequiredError') : undefined}
            onSelect={actions.selectVisaCopy}
            disabled={actions.mutation.isPending}
            labelText={t('adminWorkflowVisaCopyLabel')}
            chooseFileLabel={t('adminWorkflowChooseFileAction')}
            noFileChosenLabel={t('adminWorkflowNoFileChosen')}
            selectedFilePrefix={t('adminWorkflowSelectedFilePrefix')}
            removeFileLabel={t('adminWorkflowRemoveFileAction')}
          />
        ) : null}
        {isRejected ? (
          <Select
            label={t('adminWorkflowVisaRejectionReasonLabel')}
            value={actions.rejectionReasonCode ?? ''}
            onChange={(event) => actions.setRejectionReasonCode((event.target.value || null) as VisaRejectionReasonCode | null)}
            errorMessage={reasonError}
            options={[
              { value: '', label: '' },
              ...VISA_REJECTION_REASON_SELECT_VALUES.map((value) => ({
                value,
                label: t(VISA_REJECTION_REASON_KEYS[value] as TranslationKey),
              })),
            ]}
          />
        ) : null}
        <Textarea label={t('adminWorkflowQvcNoteLabel')} value={note} onChange={(event) => setNote(event.target.value)} rows={2} />
        {conflictMessage ? <ValidationMessage tone="error">{conflictMessage}</ValidationMessage> : null}
        {generalError ? <ValidationMessage tone="error">{generalError}</ValidationMessage> : null}
      </div>
    </ConfirmDialog>
  );
}

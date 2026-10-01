import { useEffect } from 'react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import { Badge, Button, Card, ConfirmDialog, RetryBanner, Select, ValidationMessage } from '../../../../design-system';
import { formatDate } from '../../../../../../shared/i18n/locale';
import {
  adminAiCallConfirmDescription,
  adminAiCallOutcomeLabel,
  adminAiCallOutcomeReasonLabel,
  adminAiCallOutcomeTone,
  adminAiCallReasonLabel,
  adminAiCallStatusLabel,
  adminAiCallStatusTone,
} from '../../../../../../shared/adminCandidateAiCalls/callLabels';
import { CANDIDATE_AI_CALL_ERROR_KEYS } from '../../../../../../shared/adminCandidateAiCalls/errorMessages';
import type { AdminAiCallReason, AdminCandidateAiCall, AdminCandidateAiCallError } from '../../../../lib/admin-candidate-ai-calls-client';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import { useCandidateAiCallList } from '../hooks/useCandidateAiCallList';
import { useTriggerCandidateAiCall } from '../hooks/useTriggerCandidateAiCall';

/**
 * The trigger mutation's own error message, preferring the server's
 * localized message when present. `INACTIVE_ACCOUNT` never falls through to
 * CANDIDATE_AI_CALL_ERROR_KEYS's generic map here -- that map's copy
 * ("staffAuthInactiveAccountError") is about the STAFF's own account, but on
 * this specific endpoint the far more likely cause is the selected
 * candidate being inactive (see the sign-out effect's comment above).
 */
function triggerErrorMessage(error: AdminCandidateAiCallError, t: (key: TranslationKey) => string): string {
  if (error.message) return error.message;
  if (error.code === 'INACTIVE_ACCOUNT') return t('adminCandidateAiCallInactiveCandidateError');
  return t(CANDIDATE_AI_CALL_ERROR_KEYS[error.code] as TranslationKey);
}

const CALL_REASONS: AdminAiCallReason[] = [
  'missing_documents',
  'protection_appearance_reminder',
  'urgent_compliance_action',
  'flight_information',
];

interface CandidateAiCallsCardProps {
  candidateId: string;
}

/**
 * Admin-triggered AI call history + trigger action for one candidate
 * (MPS-706/MPS-F706). Inbound helpline calls and workflow-stage-triggered
 * calls don't appear here -- see the standalone Communications log
 * (/admin/communications) for the full cross-channel view; this card is
 * scoped to what GET .../ai_calls actually returns.
 */
export function CandidateAiCallsCard({ candidateId }: CandidateAiCallsCardProps) {
  const { t, language } = useLanguage();
  const { hasPermission, signOut } = useStaffAuth();
  const query = useCandidateAiCallList(candidateId);
  const { pendingReason, openConfirm, closeConfirm, confirm, mutation } = useTriggerCandidateAiCall(candidateId);

  const canTrigger = hasPermission('trigger_ai_calls');

  useEffect(() => {
    // GET .../ai_calls never checks the selected candidate's own active
    // state (see the backend controller's #index action) -- its only
    // source of INACTIVE_ACCOUNT is the staff session itself, so it's safe
    // to treat unambiguously as a sign-out signal here.
    const code = query.error?.code;
    if (code === 'SESSION_EXPIRED') signOut('expired');
    else if (code === 'INACTIVE_ACCOUNT') signOut('manual');
  }, [query.error, signOut]);

  useEffect(() => {
    // The trigger mutation's INACTIVE_ACCOUNT is ambiguous -- backend raises
    // the same InactiveAccountError/code both for the staff session
    // (base_controller, every request) and for the selected CANDIDATE being
    // inactive (TriggerOutboundCallService's own `candidate.active?` check).
    // Signing the admin out here would be wrong in the (overwhelmingly
    // common) candidate-inactive case, so this dialog shows its own
    // candidate-specific message instead (see the render below) and never
    // signs out on this code. SESSION_EXPIRED has no such ambiguity -- it's
    // purely an authentication-layer signal regardless of source.
    if (mutation.error?.code === 'SESSION_EXPIRED') signOut('expired');
  }, [mutation.error, signOut]);

  // A staff member without trigger_ai_calls simply doesn't see this
  // section -- matches CandidateDocumentsSummaryCard's identical "no
  // actionable destination, no scary error banner" convention.
  if (query.error?.code === 'FORBIDDEN' && !canTrigger) {
    return null;
  }
  if (query.isLoading) {
    return null;
  }

  const calls = query.data ?? [];

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">{t('adminCandidateAiCallSectionTitle')}</h2>
        {canTrigger ? (
          <Select
            aria-label={t('adminCandidateAiCallTriggerLabel')}
            value=""
            onChange={(event) => {
              const reason = event.target.value as AdminAiCallReason;
              if (reason) openConfirm(reason);
            }}
            options={[
              { value: '', label: t('adminCandidateAiCallTriggerLabel') },
              ...CALL_REASONS.map((reason) => ({ value: reason, label: adminAiCallReasonLabel(reason, t) })),
            ]}
          />
        ) : null}
      </div>

      {query.isError ? (
        <div className="mb-3">
          <RetryBanner message={t('adminCandidateAiCallLoadError')} retryLabel={t('retry')} onRetry={() => query.refetch()} />
        </div>
      ) : null}

      {!query.isError && calls.length === 0 ? <p className="text-sm text-text-tertiary">{t('adminCandidateAiCallEmpty')}</p> : null}

      {calls.length > 0 ? (
        <ul className="divide-y divide-border-subtle">
          {calls.map((call) => (
            <li key={call.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-text-primary">{adminAiCallReasonLabel(call.callReason, t)}</span>
                <Badge tone={adminAiCallStatusTone(call.status)}>{adminAiCallStatusLabel(call.status, t)}</Badge>
                {call.outcome ? <Badge tone={adminAiCallOutcomeTone(call.outcome)}>{adminAiCallOutcomeLabel(call.outcome, t)}</Badge> : null}
                <span className="text-xs text-text-tertiary">{formatDate(call.createdAt, language, { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>

              {call.outcome === 'callback_required' ? (
                <p className="rounded-lg bg-warning-subtle px-3 py-2 text-sm font-medium text-warning-emphasis">
                  {adminAiCallOutcomeLabel('callback_required', t)}
                  {call.outcomeReason ? ` – ${adminAiCallOutcomeReasonLabel(call.outcomeReason, t)}` : null}
                </p>
              ) : call.outcomeReason ? (
                <p className="text-xs text-text-tertiary">{adminAiCallOutcomeReasonLabel(call.outcomeReason, t)}</p>
              ) : null}

              {call.summary ? (
                <p className="text-sm text-text-secondary">
                  <span className="font-medium text-text-tertiary">{t('adminCandidateAiCallSummaryLabel')}: </span>
                  {call.summary}
                </p>
              ) : null}

              {call.answeredAt || call.completedAt || call.triggeredBy ? (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-tertiary">
                  {call.answeredAt ? (
                    <span>
                      {t('adminCandidateAiCallAnsweredAtLabel')}: {formatDate(call.answeredAt, language, { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  ) : null}
                  {call.completedAt ? (
                    <span>
                      {t('adminCandidateAiCallCompletedAtLabel')}: {formatDate(call.completedAt, language, { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  ) : null}
                  {call.triggeredBy ? (
                    <span>
                      {t('adminCandidateAiCallTriggeredByLabel')}: {call.triggeredBy.role} ({call.triggeredBy.id})
                    </span>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <ConfirmDialog
        open={pendingReason !== null}
        onOpenChange={(open) => {
          if (!open) closeConfirm();
        }}
        title={t('adminCandidateAiCallConfirmTitle')}
        description={pendingReason ? adminAiCallConfirmDescription(pendingReason, t) : undefined}
        confirmLabel={t('adminCandidateAiCallConfirmAction')}
        cancelLabel={t('adminCandidateAiCallCancelAction')}
        closeLabel={t('dsClose')}
        onConfirm={confirm}
        isConfirming={mutation.isPending}
      >
        {mutation.isError ? <ValidationMessage>{triggerErrorMessage(mutation.error, t)}</ValidationMessage> : null}
      </ConfirmDialog>
    </Card>
  );
}

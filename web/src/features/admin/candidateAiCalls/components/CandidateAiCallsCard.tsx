import { useEffect } from 'react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import { Badge, Button, Card, ConfirmDialog, RetryBanner, Select, ValidationMessage } from '../../../../design-system';
import { formatDate } from '../../../../../../shared/i18n/locale';
import { interpolate } from '../../../../../../shared/i18n/interpolate';
import {
  adminAiCallOutcomeLabel,
  adminAiCallOutcomeReasonLabel,
  adminAiCallOutcomeTone,
  adminAiCallStatusLabel,
  adminAiCallStatusTone,
  adminAiCallTriggerLabel,
} from '../../../../../../shared/adminCandidateAiCalls/callLabels';
import { CANDIDATE_AI_CALL_ERROR_KEYS } from '../../../../../../shared/adminCandidateAiCalls/errorMessages';
import { workflowStageLabelKey } from '../../../../../../shared/adminCandidates/workflowStageLabels';
import type { AdminCandidateAiCall, AdminCandidateAiCallError } from '../../../../lib/admin-candidate-ai-calls-client';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import { useRobocallVoices } from '../../bulkCalls/hooks/useRobocallVoices';
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

interface CandidateAiCallsCardProps {
  candidateId: string;
}

/**
 * The candidate page's "AI calls" tab (MPS-706/MPS-F706): place a call with
 * one of the active call types (the library managed on the Bulk calls page),
 * and the history of every call this candidate had -- placed by hand,
 * automatic (workflow stage) and bulk.
 */
export function CandidateAiCallsCard({ candidateId }: CandidateAiCallsCardProps) {
  const { t, language } = useLanguage();
  const { hasPermission, signOut } = useStaffAuth();
  const query = useCandidateAiCallList(candidateId);
  const voices = useRobocallVoices();
  const { pendingVoiceId, openConfirm, closeConfirm, confirm, mutation } = useTriggerCandidateAiCall(candidateId);

  const canTrigger = hasPermission('trigger_ai_calls');
  const activeVoices = (voices.data ?? []).filter((voice) => voice.active);
  const pendingVoice = activeVoices.find((voice) => voice.id === pendingVoiceId);
  const voiceName = (voice: { nameEn: string; nameUr?: string }) => (language === 'ur' && voice.nameUr ? voice.nameUr : voice.nameEn);

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

  // A staff member without trigger_ai_calls has no use for this tab.
  if (query.error?.code === 'FORBIDDEN' && !canTrigger) {
    return null;
  }
  if (query.isLoading) {
    return null;
  }

  const calls = query.data ?? [];

  /** The call's name: the call type that was played, else the stage it was set up for, else a neutral label. */
  const callTitle = (call: AdminCandidateAiCall) => {
    if (call.voice && (call.voice.nameEn || call.voice.nameUr)) {
      return voiceName({ nameEn: call.voice.nameEn ?? call.voice.nameUr ?? '', nameUr: call.voice.nameUr });
    }
    return t('adminCandidateAiCallUnnamed');
  };

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-text-primary">{t('adminCandidateAiCallSectionTitle')}</h2>
          {canTrigger && activeVoices.length > 0 ? (
            <Select
              aria-label={t('adminCandidateAiCallTriggerLabel')}
              value=""
              onChange={(event) => {
                if (event.target.value) openConfirm(event.target.value);
              }}
              options={[
                { value: '', label: t('adminCandidateAiCallTriggerLabel') },
                ...activeVoices.map((voice) => ({ value: voice.id, label: voiceName(voice) })),
              ]}
            />
          ) : null}
        </div>
        {canTrigger && !voices.isLoading && !voices.isError && activeVoices.length === 0 ? (
          <p className="mt-3 text-sm text-text-tertiary">{t('adminCandidateAiCallNoCallTypes')}</p>
        ) : null}
        {canTrigger && voices.isError ? (
          <div className="mt-3">
            <RetryBanner message={t('somethingWentWrong')} retryLabel={t('retry')} onRetry={() => voices.refetch()} />
          </div>
        ) : null}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-text-primary">{t('adminCandidateAiCallHistoryTitle')}</h2>

        {query.isError ? (
          <div className="mb-3">
            <RetryBanner message={t('adminCandidateAiCallLoadError')} retryLabel={t('retry')} onRetry={() => query.refetch()} />
          </div>
        ) : null}

        {!query.isError && calls.length === 0 ? <p className="text-sm text-text-tertiary">{t('adminCandidateAiCallEmpty')}</p> : null}

        {calls.length > 0 ? (
          <ul className="divide-y divide-border-subtle">
            {calls.map((call) => {
              const stageKey = call.workflowStageCode ? workflowStageLabelKey(call.workflowStageCode) : undefined;

              return (
                <li key={call.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-medium text-text-primary">{callTitle(call)}</span>
                    <Badge tone="neutral">{adminAiCallTriggerLabel(call.trigger, t)}</Badge>
                    <Badge tone={adminAiCallStatusTone(call.status)}>{adminAiCallStatusLabel(call.status, t)}</Badge>
                    {call.outcome ? <Badge tone={adminAiCallOutcomeTone(call.outcome)}>{adminAiCallOutcomeLabel(call.outcome, t)}</Badge> : null}
                    <span className="text-xs text-text-tertiary">{formatDate(call.createdAt, language, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </div>

                  {call.trigger === 'automatic' && call.workflowStageCode ? (
                    <p className="text-xs text-text-tertiary">
                      {t('adminCandidateAiCallStageLabel')}: {stageKey ? t(stageKey) : call.workflowStageCode}
                    </p>
                  ) : null}

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
                          {t('adminCandidateAiCallTriggeredByLabel')}: {call.triggeredBy.role}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </Card>

      <ConfirmDialog
        open={pendingVoiceId !== null}
        onOpenChange={(open) => {
          if (!open) closeConfirm();
        }}
        title={t('adminCandidateAiCallConfirmTitle')}
        description={pendingVoice ? interpolate(t('adminCandidateAiCallConfirmDescription'), { name: voiceName(pendingVoice) }) : undefined}
        confirmLabel={t('adminCandidateAiCallConfirmAction')}
        cancelLabel={t('adminCandidateAiCallCancelAction')}
        closeLabel={t('dsClose')}
        onConfirm={confirm}
        isConfirming={mutation.isPending}
      >
        {mutation.isError ? <ValidationMessage>{triggerErrorMessage(mutation.error, t)}</ValidationMessage> : null}
      </ConfirmDialog>
    </>
  );
}

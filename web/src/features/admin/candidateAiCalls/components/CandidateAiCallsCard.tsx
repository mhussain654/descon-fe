import { useEffect } from 'react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import { Badge, Button, Card, ConfirmDialog, RetryBanner, Select, ValidationMessage } from '../../../../design-system';
import { formatDate } from '../../../../../../shared/i18n/locale';
import {
  adminAiCallConfirmDescription,
  adminAiCallOutcomeLabel,
  adminAiCallOutcomeTone,
  adminAiCallReasonLabel,
  adminAiCallStatusLabel,
  adminAiCallStatusTone,
} from '../../../../../../shared/adminCandidateAiCalls/callLabels';
import { CANDIDATE_AI_CALL_ERROR_KEYS } from '../../../../../../shared/adminCandidateAiCalls/errorMessages';
import type { AdminAiCallReason, AdminCandidateAiCall } from '../../../../lib/admin-candidate-ai-calls-client';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import { useCandidateAiCallList } from '../hooks/useCandidateAiCallList';
import { useTriggerCandidateAiCall } from '../hooks/useTriggerCandidateAiCall';

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
    const code = query.error?.code ?? mutation.error?.code;
    if (code === 'SESSION_EXPIRED') signOut('expired');
    else if (code === 'INACTIVE_ACCOUNT') signOut('manual');
  }, [query.error, mutation.error, signOut]);

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
            <li key={call.id} className="flex flex-wrap items-center gap-3 py-2 first:pt-0 last:pb-0">
              <span className="text-sm font-medium text-text-primary">{adminAiCallReasonLabel(call.callReason, t)}</span>
              <Badge tone={adminAiCallStatusTone(call.status)}>{adminAiCallStatusLabel(call.status, t)}</Badge>
              {call.outcome ? <Badge tone={adminAiCallOutcomeTone(call.outcome)}>{adminAiCallOutcomeLabel(call.outcome, t)}</Badge> : null}
              <span className="text-xs text-text-tertiary">{formatDate(call.createdAt, language, { dateStyle: 'medium', timeStyle: 'short' })}</span>
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
        {mutation.isError && mutation.error.code !== 'IDEMPOTENCY_CONFLICT' ? (
          <ValidationMessage>
            {mutation.error.message || t(CANDIDATE_AI_CALL_ERROR_KEYS[mutation.error.code] as TranslationKey)}
          </ValidationMessage>
        ) : null}
      </ConfirmDialog>
    </Card>
  );
}

import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { toast } from '../../../../design-system';
import { adminCandidateAiCallsClient } from '../../../../lib/admin-candidate-ai-calls-client';
import type { AdminAiCallReason, AdminCandidateAiCall, AdminCandidateAiCallError } from '../../../../lib/admin-candidate-ai-calls-client';
import {
  clearCallIdempotencyKey,
  EMPTY_CALL_IDEMPOTENCY_KEY_STATE,
  randomCallIdempotencyKey,
  resolveCallIdempotencyKey,
  type CallIdempotencyKeyState,
} from '../../../../../../shared/adminCandidateAiCalls/callIdempotency';
import { adminCandidateAiCallQueries } from '../../../../../../shared/queryKeys/adminCandidateAiCallQueries';
import { CANDIDATE_AI_CALL_ERROR_KEYS } from '../../../../../../shared/adminCandidateAiCalls/errorMessages';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';

/**
 * Error codes meaning there is nothing left to fix from inside this dialog
 * (the candidate no longer exists, or calling is disabled account-wide) --
 * these close the confirm dialog and refresh the call history instead of
 * leaving it open, with a toast standing in for the now-dismissed dialog's
 * own error slot. `VALIDATION_FAILED` (unknown call_reason, no current
 * assignment, inactive candidate, outside calling hours) is deliberately
 * NOT terminal: the dialog stays open with the server's own message
 * (rendered via ConfirmDialog's children), since a human reading exactly
 * why the call was rejected is the actionable outcome AGENTS.md's
 * "Display actionable field-level errors" asks for here -- unlike
 * useSubmitWorkflowTransition.ts's WORKFLOW_TRANSITION_STALE/
 * PREREQUISITE_MISSING, there's no separate stage-review destination for
 * this action to route the user to instead.
 */
const TERMINAL_ERROR_CODES = new Set<AdminCandidateAiCallError['code']>(['NOT_FOUND', 'CALLING_UNAVAILABLE']);

interface TriggerVariables {
  candidateId: string;
  callReason: AdminAiCallReason;
  idempotencyKey: string;
}

/** Triggers an admin-initiated outbound AI call for one candidate, through a confirm-dialog-shaped flow -- placing a real, billed phone call is consequential, so it is never a single click. */
export function useTriggerCandidateAiCall(candidateId: string | undefined) {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const [pendingReason, setPendingReason] = useState<AdminAiCallReason | null>(null);
  const [idempotencyState, setIdempotencyState] = useState<CallIdempotencyKeyState>(EMPTY_CALL_IDEMPOTENCY_KEY_STATE);

  const mutation = useMutation<AdminCandidateAiCall, AdminCandidateAiCallError, TriggerVariables>({
    mutationFn: (variables) =>
      adminCandidateAiCallsClient.triggerCandidateAiCall(variables.candidateId, variables.callReason, variables.idempotencyKey),
    onSuccess: () => {
      if (candidateId) queryClient.invalidateQueries({ queryKey: adminCandidateAiCallQueries.list(candidateId, language) });
      toast.success(t('adminCandidateAiCallTriggerSuccessToast'));
      setPendingReason(null);
      setIdempotencyState(clearCallIdempotencyKey());
    },
    onError: (error) => {
      if (error.code === 'IDEMPOTENCY_CONFLICT') {
        setIdempotencyState(clearCallIdempotencyKey());
        return;
      }
      if (TERMINAL_ERROR_CODES.has(error.code)) {
        setIdempotencyState(clearCallIdempotencyKey());
        setPendingReason(null);
        toast.error(error.message || t(CANDIDATE_AI_CALL_ERROR_KEYS[error.code] as TranslationKey));
        if (candidateId) queryClient.invalidateQueries({ queryKey: adminCandidateAiCallQueries.list(candidateId, language) });
        return;
      }
      // VALIDATION_FAILED/FORBIDDEN/INACTIVE_ACCOUNT/SESSION_EXPIRED/
      // RATE_LIMITED/PROVIDER_ERROR/NETWORK_ERROR/OFFLINE/SERVER_ERROR: keep
      // the dialog open and the same key so a manual retry replays safely
      // (VALIDATION_FAILED's message renders inside the dialog itself, via
      // ConfirmDialog's children in CandidateAiCallsCard).
    },
  });

  const openConfirm = useCallback(
    (callReason: AdminAiCallReason) => {
      if (mutation.isPending) return;
      mutation.reset();
      setIdempotencyState(EMPTY_CALL_IDEMPOTENCY_KEY_STATE);
      setPendingReason(callReason);
    },
    [mutation]
  );

  const closeConfirm = useCallback(() => {
    if (mutation.isPending) return;
    setPendingReason(null);
    setIdempotencyState(clearCallIdempotencyKey());
  }, [mutation]);

  const confirm = useCallback(() => {
    // Guards double-click/concurrent submission (disabling the confirm
    // button while pending covers the UI, this covers a caller bypassing
    // it) -- mirrors useSubmitWorkflowTransition.ts's identical guard.
    if (!candidateId || !pendingReason || mutation.isPending) return;

    const selection = { candidateId, callReason: pendingReason };
    const resolved = resolveCallIdempotencyKey(idempotencyState, selection, randomCallIdempotencyKey);
    setIdempotencyState(resolved);
    mutation.mutate({ candidateId, callReason: pendingReason, idempotencyKey: resolved.key as string });
  }, [candidateId, pendingReason, mutation, idempotencyState]);

  return { pendingReason, openConfirm, closeConfirm, confirm, mutation };
}

import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { toast } from '../../../../design-system';
import { adminWorkflowClient } from '../../../../lib/admin-workflow-client';
import type { AdminWorkflowError, WorkflowTransitionResult } from '../../../../lib/admin-workflow-client';
import {
  clearTransitionIdempotencyKey,
  EMPTY_TRANSITION_IDEMPOTENCY_KEY_STATE,
  randomTransitionIdempotencyKey,
  resolveTransitionIdempotencyKey,
  type TransitionIdempotencyKeyState,
} from '../../../../../../shared/adminWorkflow/transitionIdempotency';
import { documentQueries } from '../../../../../../shared/queryKeys/documentQueries';
import { workflowQueries } from '../../../../../../shared/queryKeys/workflowQueries';

/**
 * Error codes meaning the transition itself did not go through and retrying
 * the same confirmation would be misleading -- these close the confirm
 * dialog and refresh state/transitions instead of offering a blind retry.
 * `WORKFLOW_TRANSITION_STALE` is deliberately here too (ticket: "For stale
 * workflow state, do not silently resubmit. Refresh the workflow and ask
 * the user to review the new state.") -- `staleNotice` (below) is what asks
 * them to review it, since simply reopening the same dialog with the old
 * expected-stage value would just fail identically again.
 */
const TERMINAL_ERROR_CODES = new Set<AdminWorkflowError['code']>([
  'WORKFLOW_TRANSITION_STALE',
  'WORKFLOW_TRANSITION_PREREQUISITE_MISSING',
]);

interface SubmitVariables {
  candidateId: string;
  toStageCode: string;
  expectedCurrentStageCode: string | undefined;
  idempotencyKey: string;
}

/**
 * One hook instance serves every transition card the workflow panel can
 * render (Phase A has only the Qatar BU card; QVC/protection cards added
 * later reuse this same hook) -- `pendingToStageCode` tracks *which*
 * transition the open confirm dialog applies to.
 */
export function useSubmitWorkflowTransition(candidateId: string | undefined) {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const [pendingToStageCode, setPendingToStageCode] = useState<string | null>(null);
  const [staleNotice, setStaleNotice] = useState(false);
  const [idempotencyState, setIdempotencyState] = useState<TransitionIdempotencyKeyState>(
    EMPTY_TRANSITION_IDEMPOTENCY_KEY_STATE
  );

  const invalidateWorkflowData = useCallback(() => {
    if (!candidateId) return;
    queryClient.invalidateQueries({ queryKey: workflowQueries.adminState(candidateId, language) });
    queryClient.invalidateQueries({ queryKey: workflowQueries.adminTransitions(candidateId, language) });
    queryClient.invalidateQueries({ queryKey: workflowQueries.adminHistory(candidateId, language) });
    // "Relevant candidate summaries" (ticket) -- the same staff candidate-
    // summary invalidation target useReviewDecision.ts already uses after a
    // document decision, since a workflow-stage change is just as relevant
    // to any staff summary view keyed on this candidate.
    queryClient.invalidateQueries({ queryKey: documentQueries.staffCandidateSummary(candidateId, language) });
  }, [queryClient, candidateId, language]);

  const mutation = useMutation<WorkflowTransitionResult, AdminWorkflowError, SubmitVariables>({
    mutationFn: (variables) =>
      adminWorkflowClient.submitTransition({
        candidateId: variables.candidateId,
        toStageCode: variables.toStageCode,
        expectedCurrentStageCode: variables.expectedCurrentStageCode,
        idempotencyKey: variables.idempotencyKey,
      }),
    onSuccess: () => {
      invalidateWorkflowData();
      toast.success(t('adminWorkflowTransitionSuccessToast'));
      setPendingToStageCode(null);
      setStaleNotice(false);
      setIdempotencyState(clearTransitionIdempotencyKey());
    },
    onError: (error) => {
      if (error.code === 'IDEMPOTENCY_CONFLICT') {
        setIdempotencyState(clearTransitionIdempotencyKey());
        return;
      }
      if (TERMINAL_ERROR_CODES.has(error.code)) {
        setIdempotencyState(clearTransitionIdempotencyKey());
        setPendingToStageCode(null);
        setStaleNotice(error.code === 'WORKFLOW_TRANSITION_STALE');
        invalidateWorkflowData();
        return;
      }
      // VALIDATION_ERROR/RATE_LIMITED/NETWORK_ERROR/OFFLINE/SERVER_ERROR/
      // IDEMPOTENCY_IN_PROGRESS: keep the dialog open and the same key so a
      // manual retry replays safely.
    },
  });

  const openConfirm = useCallback(
    (toStageCode: string) => {
      if (mutation.isPending) return;
      mutation.reset();
      setIdempotencyState(EMPTY_TRANSITION_IDEMPOTENCY_KEY_STATE);
      setStaleNotice(false);
      setPendingToStageCode(toStageCode);
    },
    [mutation]
  );

  const closeConfirm = useCallback(() => {
    if (mutation.isPending) return;
    setPendingToStageCode(null);
    setIdempotencyState(clearTransitionIdempotencyKey());
  }, [mutation]);

  const dismissStaleNotice = useCallback(() => setStaleNotice(false), []);

  const confirm = useCallback(
    (expectedCurrentStageCode: string | undefined) => {
      // Guards double-click/concurrent submission (disabling the confirm
      // button while pending covers the UI, this covers a caller bypassing
      // it) -- ticket: "Disable duplicate submissions while the request is
      // pending."
      if (!candidateId || !pendingToStageCode || mutation.isPending) return;

      const selection = { candidateId, toStageCode: pendingToStageCode, expectedCurrentStageCode };
      const resolved = resolveTransitionIdempotencyKey(idempotencyState, selection, randomTransitionIdempotencyKey);
      setIdempotencyState(resolved);
      mutation.mutate({
        candidateId,
        toStageCode: pendingToStageCode,
        expectedCurrentStageCode,
        idempotencyKey: resolved.key as string,
      });
    },
    [candidateId, pendingToStageCode, mutation, idempotencyState]
  );

  return {
    pendingToStageCode,
    staleNotice,
    dismissStaleNotice,
    openConfirm,
    closeConfirm,
    confirm,
    mutation,
  };
}

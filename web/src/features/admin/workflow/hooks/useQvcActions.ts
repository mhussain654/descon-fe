import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { toast } from '../../../../design-system';
import { adminWorkflowClient } from '../../../../lib/admin-workflow-client';
import type { AdminWorkflowError, QvcActionResult, QvcOutcomeCode } from '../../../../lib/admin-workflow-client';
import { documentQueries } from '../../../../../../shared/queryKeys/documentQueries';
import { workflowQueries } from '../../../../../../shared/queryKeys/workflowQueries';

/** Same terminal-error handling as useSubmitWorkflowTransition.ts: the action did not go through, so retrying blind would be misleading -- close the dialog and refresh instead. */
const TERMINAL_ERROR_CODES = new Set<AdminWorkflowError['code']>([
  'WORKFLOW_TRANSITION_STALE',
  'WORKFLOW_TRANSITION_PREREQUISITE_MISSING',
]);

function randomIdempotencyKey(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

interface ScheduleSelection {
  candidateId: string;
  appointmentDate: string;
  expectedCurrentStageCode: string | undefined;
}

interface OutcomeSelection {
  candidateId: string;
  qvcAttemptId: string;
  outcomeCode: QvcOutcomeCode | undefined;
  noShow: boolean;
  expectedCurrentStageCode: string | undefined;
}

function sameScheduleSelection(a: ScheduleSelection | null, b: ScheduleSelection): boolean {
  return (
    !!a &&
    a.candidateId === b.candidateId &&
    a.appointmentDate === b.appointmentDate &&
    a.expectedCurrentStageCode === b.expectedCurrentStageCode
  );
}

function sameOutcomeSelection(a: OutcomeSelection | null, b: OutcomeSelection): boolean {
  return (
    !!a &&
    a.candidateId === b.candidateId &&
    a.qvcAttemptId === b.qvcAttemptId &&
    a.outcomeCode === b.outcomeCode &&
    a.noShow === b.noShow &&
    a.expectedCurrentStageCode === b.expectedCurrentStageCode
  );
}

/**
 * Owns both QVC dialogs -- scheduling a new appointment and recording an
 * outcome for an open attempt. These are separate backend actions (POST vs
 * PATCH .../qvc_attempts) with separate idempotency-key lifecycles, since
 * reusing one key across the two would fingerprint-mismatch at the backend,
 * but they follow the exact same stale-state/duplicate-submission handling
 * shape as useSubmitWorkflowTransition.ts.
 */
export function useQvcActions(candidateId: string | undefined) {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();

  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleKey, setScheduleKey] = useState<{ key: string; selection: ScheduleSelection } | null>(null);

  const [outcomeAttemptId, setOutcomeAttemptId] = useState<string | null>(null);
  const [outcomeKey, setOutcomeKey] = useState<{ key: string; selection: OutcomeSelection } | null>(null);

  const [staleNotice, setStaleNotice] = useState(false);

  const invalidateWorkflowData = useCallback(() => {
    if (!candidateId) return;
    queryClient.invalidateQueries({ queryKey: workflowQueries.adminState(candidateId, language) });
    queryClient.invalidateQueries({ queryKey: workflowQueries.adminTransitions(candidateId, language) });
    queryClient.invalidateQueries({ queryKey: workflowQueries.adminHistory(candidateId, language) });
    queryClient.invalidateQueries({ queryKey: workflowQueries.adminQvcAttempts(candidateId, language) });
    queryClient.invalidateQueries({ queryKey: documentQueries.staffCandidateSummary(candidateId, language) });
  }, [queryClient, candidateId, language]);

  const scheduleMutation = useMutation<
    QvcActionResult,
    AdminWorkflowError,
    ScheduleSelection & { note: string | undefined; idempotencyKey: string }
  >({
    mutationFn: (variables) =>
      adminWorkflowClient.scheduleQvcAppointment({
        candidateId: variables.candidateId,
        appointmentDate: variables.appointmentDate,
        expectedCurrentStageCode: variables.expectedCurrentStageCode,
        note: variables.note,
        idempotencyKey: variables.idempotencyKey,
      }),
    onSuccess: () => {
      invalidateWorkflowData();
      toast.success(t('adminWorkflowQvcScheduleSuccessToast'));
      setScheduleDialogOpen(false);
      setStaleNotice(false);
      setScheduleKey(null);
    },
    onError: (error) => {
      if (error.code === 'IDEMPOTENCY_CONFLICT') {
        setScheduleKey(null);
        return;
      }
      if (TERMINAL_ERROR_CODES.has(error.code)) {
        setScheduleKey(null);
        setScheduleDialogOpen(false);
        setStaleNotice(error.code === 'WORKFLOW_TRANSITION_STALE');
        invalidateWorkflowData();
      }
      // VALIDATION_ERROR (e.g. an open attempt already exists) /
      // RATE_LIMITED/NETWORK_ERROR/OFFLINE/SERVER_ERROR/IDEMPOTENCY_IN_PROGRESS:
      // keep the dialog open and the same key so a manual retry replays safely.
    },
  });

  const outcomeMutation = useMutation<
    QvcActionResult,
    AdminWorkflowError,
    OutcomeSelection & { note: string | undefined; idempotencyKey: string }
  >({
    mutationFn: (variables) =>
      adminWorkflowClient.recordQvcOutcome({
        candidateId: variables.candidateId,
        qvcAttemptId: variables.qvcAttemptId,
        outcomeCode: variables.outcomeCode,
        noShow: variables.noShow,
        expectedCurrentStageCode: variables.expectedCurrentStageCode,
        note: variables.note,
        idempotencyKey: variables.idempotencyKey,
      }),
    onSuccess: () => {
      invalidateWorkflowData();
      toast.success(t('adminWorkflowQvcOutcomeSuccessToast'));
      setOutcomeAttemptId(null);
      setStaleNotice(false);
      setOutcomeKey(null);
    },
    onError: (error) => {
      if (error.code === 'IDEMPOTENCY_CONFLICT') {
        setOutcomeKey(null);
        return;
      }
      if (TERMINAL_ERROR_CODES.has(error.code)) {
        setOutcomeKey(null);
        setOutcomeAttemptId(null);
        setStaleNotice(error.code === 'WORKFLOW_TRANSITION_STALE');
        invalidateWorkflowData();
      }
    },
  });

  const openScheduleDialog = useCallback(() => {
    if (scheduleMutation.isPending) return;
    scheduleMutation.reset();
    setScheduleKey(null);
    setStaleNotice(false);
    setScheduleDialogOpen(true);
  }, [scheduleMutation]);

  const closeScheduleDialog = useCallback(() => {
    if (scheduleMutation.isPending) return;
    setScheduleDialogOpen(false);
    setScheduleKey(null);
  }, [scheduleMutation]);

  const submitSchedule = useCallback(
    (appointmentDate: string, expectedCurrentStageCode: string | undefined, note?: string) => {
      if (!candidateId || scheduleMutation.isPending) return;

      const selection: ScheduleSelection = { candidateId, appointmentDate, expectedCurrentStageCode };
      const key = sameScheduleSelection(scheduleKey?.selection ?? null, selection)
        ? (scheduleKey as { key: string; selection: ScheduleSelection }).key
        : randomIdempotencyKey('admin-qvc-schedule');
      setScheduleKey({ key, selection });
      scheduleMutation.mutate({ ...selection, note, idempotencyKey: key });
    },
    [candidateId, scheduleMutation, scheduleKey]
  );

  const openOutcomeDialog = useCallback(
    (attemptId: string) => {
      if (outcomeMutation.isPending) return;
      outcomeMutation.reset();
      setOutcomeKey(null);
      setStaleNotice(false);
      setOutcomeAttemptId(attemptId);
    },
    [outcomeMutation]
  );

  const closeOutcomeDialog = useCallback(() => {
    if (outcomeMutation.isPending) return;
    setOutcomeAttemptId(null);
    setOutcomeKey(null);
  }, [outcomeMutation]);

  const submitOutcome = useCallback(
    (
      outcomeCode: QvcOutcomeCode | undefined,
      noShow: boolean,
      expectedCurrentStageCode: string | undefined,
      note?: string
    ) => {
      if (!candidateId || !outcomeAttemptId || outcomeMutation.isPending) return;

      const selection: OutcomeSelection = {
        candidateId,
        qvcAttemptId: outcomeAttemptId,
        outcomeCode,
        noShow,
        expectedCurrentStageCode,
      };
      const key = sameOutcomeSelection(outcomeKey?.selection ?? null, selection)
        ? (outcomeKey as { key: string; selection: OutcomeSelection }).key
        : randomIdempotencyKey('admin-qvc-outcome');
      setOutcomeKey({ key, selection });
      outcomeMutation.mutate({ ...selection, note, idempotencyKey: key });
    },
    [candidateId, outcomeAttemptId, outcomeMutation, outcomeKey]
  );

  const dismissStaleNotice = useCallback(() => setStaleNotice(false), []);

  return {
    scheduleDialogOpen,
    openScheduleDialog,
    closeScheduleDialog,
    submitSchedule,
    scheduleMutation,
    outcomeAttemptId,
    openOutcomeDialog,
    closeOutcomeDialog,
    submitOutcome,
    outcomeMutation,
    staleNotice,
    dismissStaleNotice,
  };
}

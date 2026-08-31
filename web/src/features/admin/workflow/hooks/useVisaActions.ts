import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { toast } from '../../../../design-system';
import { adminWorkflowClient } from '../../../../lib/admin-workflow-client';
import type {
  AdminWorkflowError,
  VisaCopyAccessResult,
  VisaDecisionResult,
  VisaOutcomeCode,
  VisaRejectionReasonCode,
} from '../../../../lib/admin-workflow-client';
import { documentQueries } from '../../../../../../shared/queryKeys/documentQueries';
import { workflowQueries } from '../../../../../../shared/queryKeys/workflowQueries';
import { useShortLivedAccess } from './useShortLivedAccess';

/** Same terminal-error handling as useSubmitWorkflowTransition.ts: the decision did not go through, so retrying blind would be misleading -- close the dialog and refresh instead. */
const TERMINAL_ERROR_CODES = new Set<AdminWorkflowError['code']>([
  'WORKFLOW_TRANSITION_STALE',
  'WORKFLOW_TRANSITION_PREREQUISITE_MISSING',
]);

function randomIdempotencyKey(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Only the file's identity, never its bytes -- mirrors candidateDocuments' fileSignature() pattern so re-selecting the identical file replays the same key, and any change mints a fresh one. */
function fileSignature(file: File | null): string | null {
  return file ? `${file.name}:${file.size}:${file.lastModified}` : null;
}

interface DecisionSelection {
  candidateId: string;
  outcomeCode: VisaOutcomeCode;
  decisionDate: string;
  rejectionReasonCode: VisaRejectionReasonCode | null;
  visaCopySignature: string | null;
  expectedCurrentStageCode: string | undefined;
}

function sameDecisionSelection(a: DecisionSelection | null, b: DecisionSelection): boolean {
  return (
    !!a &&
    a.candidateId === b.candidateId &&
    a.outcomeCode === b.outcomeCode &&
    a.decisionDate === b.decisionDate &&
    a.rejectionReasonCode === b.rejectionReasonCode &&
    a.visaCopySignature === b.visaCopySignature &&
    a.expectedCurrentStageCode === b.expectedCurrentStageCode
  );
}

function buildFormData(selection: DecisionSelection, visaCopy: File | null, note: string | undefined): FormData {
  const formData = new FormData();
  formData.append('candidate_visa_decision[outcome_code]', selection.outcomeCode);
  formData.append('candidate_visa_decision[decision_date]', selection.decisionDate);
  if (selection.outcomeCode === 'issued' && visaCopy) {
    formData.append('candidate_visa_decision[visa_copy]', visaCopy);
  }
  if (selection.outcomeCode === 'rejected' && selection.rejectionReasonCode) {
    formData.append('candidate_visa_decision[rejection_reason_code]', selection.rejectionReasonCode);
  }
  if (selection.expectedCurrentStageCode) {
    formData.append('candidate_visa_decision[expected_current_stage_code]', selection.expectedCurrentStageCode);
  }
  if (note) {
    formData.append('candidate_visa_decision[note]', note);
  }
  return formData;
}

/**
 * Owns the visa-decision recording dialog (issued or rejected -- one flow,
 * `recordingOutcome` selects which fields apply) and, separately, the
 * short-lived visa-copy access credential requested only when staff open/
 * download an existing decision's copy (ticket: "Request short-lived access
 * only when the staff user opens/downloads the copy.").
 */
export function useVisaActions(candidateId: string | undefined) {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();

  const [recordingOutcome, setRecordingOutcome] = useState<VisaOutcomeCode | null>(null);
  const [decisionDate, setDecisionDate] = useState('');
  const [visaCopy, setVisaCopy] = useState<File | null>(null);
  const [fileError, setFileError] = useState<'FILE_REQUIRED' | null>(null);
  const [rejectionReasonCode, setRejectionReasonCode] = useState<VisaRejectionReasonCode | null>(null);
  const [decisionKey, setDecisionKey] = useState<{ key: string; selection: DecisionSelection } | null>(null);
  const [staleNotice, setStaleNotice] = useState(false);

  const copyAccess = useShortLivedAccess<VisaCopyAccessResult>();

  const invalidateWorkflowData = useCallback(() => {
    if (!candidateId) return;
    queryClient.invalidateQueries({ queryKey: workflowQueries.adminState(candidateId, language) });
    queryClient.invalidateQueries({ queryKey: workflowQueries.adminTransitions(candidateId, language) });
    queryClient.invalidateQueries({ queryKey: workflowQueries.adminHistory(candidateId, language) });
    queryClient.invalidateQueries({ queryKey: workflowQueries.adminVisaDecisions(candidateId, language) });
    queryClient.invalidateQueries({ queryKey: documentQueries.staffCandidateSummary(candidateId, language) });
  }, [queryClient, candidateId, language]);

  const mutation = useMutation<
    VisaDecisionResult,
    AdminWorkflowError,
    { formData: FormData; idempotencyKey: string }
  >({
    mutationFn: (variables) =>
      adminWorkflowClient.recordVisaDecision({
        candidateId: candidateId as string,
        formData: variables.formData,
        idempotencyKey: variables.idempotencyKey,
      }),
    onSuccess: () => {
      invalidateWorkflowData();
      toast.success(t('adminWorkflowVisaDecisionSuccessToast'));
      setRecordingOutcome(null);
      setStaleNotice(false);
      setDecisionKey(null);
    },
    onError: (error) => {
      if (error.code === 'IDEMPOTENCY_CONFLICT') {
        setDecisionKey(null);
        return;
      }
      if (TERMINAL_ERROR_CODES.has(error.code)) {
        setDecisionKey(null);
        setRecordingOutcome(null);
        setStaleNotice(error.code === 'WORKFLOW_TRANSITION_STALE');
        invalidateWorkflowData();
      }
      // VALIDATION_ERROR/RATE_LIMITED/NETWORK_ERROR/OFFLINE/SERVER_ERROR/
      // IDEMPOTENCY_IN_PROGRESS: keep the dialog open and the same key so a
      // manual retry replays safely.
    },
  });

  const openRecordDialog = useCallback(
    (outcomeCode: VisaOutcomeCode) => {
      if (mutation.isPending) return;
      mutation.reset();
      setDecisionDate('');
      setVisaCopy(null);
      setFileError(null);
      setRejectionReasonCode(null);
      setDecisionKey(null);
      setStaleNotice(false);
      setRecordingOutcome(outcomeCode);
    },
    [mutation]
  );

  const closeRecordDialog = useCallback(() => {
    if (mutation.isPending) return;
    setRecordingOutcome(null);
    setDecisionKey(null);
  }, [mutation]);

  const selectVisaCopy = useCallback((nextFile: File | null) => {
    setVisaCopy(nextFile);
    setFileError(null);
  }, []);

  const dismissStaleNotice = useCallback(() => setStaleNotice(false), []);

  const submit = useCallback(
    (expectedCurrentStageCode: string | undefined, note?: string) => {
      if (!candidateId || !recordingOutcome || mutation.isPending) return;
      if (recordingOutcome === 'issued' && !visaCopy) {
        setFileError('FILE_REQUIRED');
        return;
      }

      const selection: DecisionSelection = {
        candidateId,
        outcomeCode: recordingOutcome,
        decisionDate,
        rejectionReasonCode: recordingOutcome === 'rejected' ? rejectionReasonCode : null,
        visaCopySignature: recordingOutcome === 'issued' ? fileSignature(visaCopy) : null,
        expectedCurrentStageCode,
      };
      const key = sameDecisionSelection(decisionKey?.selection ?? null, selection)
        ? (decisionKey as { key: string; selection: DecisionSelection }).key
        : randomIdempotencyKey('admin-visa-decision');
      setDecisionKey({ key, selection });
      mutation.mutate({ formData: buildFormData(selection, visaCopy, note), idempotencyKey: key });
    },
    [candidateId, recordingOutcome, decisionDate, rejectionReasonCode, visaCopy, decisionKey, mutation]
  );

  const requestCopyAccess = useCallback(
    (visaDecisionId: string) => {
      if (!candidateId) return;
      void copyAccess.requestAccess(() => adminWorkflowClient.getVisaCopyAccess(candidateId, visaDecisionId));
    },
    [candidateId, copyAccess]
  );

  return {
    recordingOutcome,
    openRecordDialog,
    closeRecordDialog,
    decisionDate,
    setDecisionDate,
    visaCopy,
    selectVisaCopy,
    fileError,
    rejectionReasonCode,
    setRejectionReasonCode,
    submit,
    mutation,
    staleNotice,
    dismissStaleNotice,
    copyAccess,
    requestCopyAccess,
  };
}

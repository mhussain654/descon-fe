import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { toast } from '../../../../design-system';
import { adminWorkflowClient } from '../../../../lib/admin-workflow-client';
import type { AdminWorkflowError, FlightDetailResult, FlightTicketAccessResult } from '../../../../lib/admin-workflow-client';
import { documentQueries } from '../../../../../../shared/queryKeys/documentQueries';
import { workflowQueries } from '../../../../../../shared/queryKeys/workflowQueries';
import { useShortLivedAccess } from './useShortLivedAccess';

/** Same terminal-error handling as useSubmitWorkflowTransition.ts: the action did not go through, so retrying blind would be misleading -- close the dialog and refresh instead. */
const TERMINAL_ERROR_CODES = new Set<AdminWorkflowError['code']>([
  'WORKFLOW_TRANSITION_STALE',
  'WORKFLOW_TRANSITION_PREREQUISITE_MISSING',
]);

function randomIdempotencyKey(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function fileSignature(file: File | null): string | null {
  return file ? `${file.name}:${file.size}:${file.lastModified}` : null;
}

interface FlightDetailSelection {
  candidateId: string;
  airline: string;
  flightNumber: string;
  sector: string;
  flightDate: string;
  ticketSignature: string | null;
  expectedCurrentStageCode: string | undefined;
}

function sameFlightDetailSelection(a: FlightDetailSelection | null, b: FlightDetailSelection): boolean {
  return (
    !!a &&
    a.candidateId === b.candidateId &&
    a.airline === b.airline &&
    a.flightNumber === b.flightNumber &&
    a.sector === b.sector &&
    a.flightDate === b.flightDate &&
    a.ticketSignature === b.ticketSignature &&
    a.expectedCurrentStageCode === b.expectedCurrentStageCode
  );
}

function buildFlightDetailFormData(selection: FlightDetailSelection, ticket: File | null, note: string | undefined): FormData {
  const formData = new FormData();
  formData.append('candidate_flight_detail[airline]', selection.airline);
  formData.append('candidate_flight_detail[flight_number]', selection.flightNumber);
  formData.append('candidate_flight_detail[sector]', selection.sector);
  formData.append('candidate_flight_detail[flight_date]', selection.flightDate);
  if (ticket) {
    formData.append('candidate_flight_detail[ticket]', ticket);
  }
  if (selection.expectedCurrentStageCode) {
    formData.append('candidate_flight_detail[expected_current_stage_code]', selection.expectedCurrentStageCode);
  }
  if (note) {
    formData.append('candidate_flight_detail[note]', note);
  }
  return formData;
}

interface MobilizeSelection {
  candidateId: string;
  mobilizedOn: string;
  expectedCurrentStageCode: string | undefined;
}

function sameMobilizeSelection(a: MobilizeSelection | null, b: MobilizeSelection): boolean {
  return (
    !!a &&
    a.candidateId === b.candidateId &&
    a.mobilizedOn === b.mobilizedOn &&
    a.expectedCurrentStageCode === b.expectedCurrentStageCode
  );
}

/**
 * Owns the flight-details recording dialog, the final mobilization dialog,
 * and the short-lived ticket access credential (requested only when staff
 * open/download the ticket) -- mirrors useVisaActions.ts's shape for the
 * same reasons (two distinct backend actions with separate idempotency-key
 * lifecycles, one shared stale-conflict notice since only one dialog is
 * ever open at a time).
 */
export function useFlightActions(candidateId: string | undefined) {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();

  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [airline, setAirline] = useState('');
  const [flightNumber, setFlightNumber] = useState('');
  const [sector, setSector] = useState('');
  const [flightDate, setFlightDate] = useState('');
  const [ticket, setTicket] = useState<File | null>(null);
  const [ticketError, setTicketError] = useState<'FILE_REQUIRED' | null>(null);
  const [recordKey, setRecordKey] = useState<{ key: string; selection: FlightDetailSelection } | null>(null);

  const [mobilizeDialogOpen, setMobilizeDialogOpen] = useState(false);
  const [mobilizedOn, setMobilizedOn] = useState('');
  const [mobilizeKey, setMobilizeKey] = useState<{ key: string; selection: MobilizeSelection } | null>(null);

  const [staleNotice, setStaleNotice] = useState(false);

  const ticketAccess = useShortLivedAccess<FlightTicketAccessResult>();

  const invalidateWorkflowData = useCallback(() => {
    if (!candidateId) return;
    queryClient.invalidateQueries({ queryKey: workflowQueries.adminState(candidateId, language) });
    queryClient.invalidateQueries({ queryKey: workflowQueries.adminTransitions(candidateId, language) });
    queryClient.invalidateQueries({ queryKey: workflowQueries.adminHistory(candidateId, language) });
    queryClient.invalidateQueries({ queryKey: workflowQueries.adminFlightDetail(candidateId, language) });
    queryClient.invalidateQueries({ queryKey: documentQueries.staffCandidateSummary(candidateId, language) });
  }, [queryClient, candidateId, language]);

  const recordMutation = useMutation<FlightDetailResult, AdminWorkflowError, { formData: FormData; idempotencyKey: string }>({
    mutationFn: (variables) =>
      adminWorkflowClient.recordFlightDetail({
        candidateId: candidateId as string,
        formData: variables.formData,
        idempotencyKey: variables.idempotencyKey,
      }),
    onSuccess: () => {
      invalidateWorkflowData();
      toast.success(t('adminWorkflowFlightDetailSuccessToast'));
      setRecordDialogOpen(false);
      setStaleNotice(false);
      setRecordKey(null);
    },
    onError: (error) => {
      if (error.code === 'IDEMPOTENCY_CONFLICT') {
        setRecordKey(null);
        return;
      }
      if (TERMINAL_ERROR_CODES.has(error.code)) {
        setRecordKey(null);
        setRecordDialogOpen(false);
        setStaleNotice(error.code === 'WORKFLOW_TRANSITION_STALE');
        invalidateWorkflowData();
      }
    },
  });

  const mobilizeMutation = useMutation<
    FlightDetailResult,
    AdminWorkflowError,
    MobilizeSelection & { note: string | undefined; idempotencyKey: string }
  >({
    mutationFn: (variables) =>
      adminWorkflowClient.mobilizeFlightDetail({
        candidateId: variables.candidateId,
        mobilizedOn: variables.mobilizedOn,
        expectedCurrentStageCode: variables.expectedCurrentStageCode,
        note: variables.note,
        idempotencyKey: variables.idempotencyKey,
      }),
    onSuccess: () => {
      invalidateWorkflowData();
      toast.success(t('adminWorkflowMobilizationSuccessToast'));
      setMobilizeDialogOpen(false);
      setStaleNotice(false);
      setMobilizeKey(null);
    },
    onError: (error) => {
      if (error.code === 'IDEMPOTENCY_CONFLICT') {
        setMobilizeKey(null);
        return;
      }
      if (TERMINAL_ERROR_CODES.has(error.code)) {
        setMobilizeKey(null);
        setMobilizeDialogOpen(false);
        setStaleNotice(error.code === 'WORKFLOW_TRANSITION_STALE');
        invalidateWorkflowData();
      }
    },
  });

  const openRecordDialog = useCallback(() => {
    if (recordMutation.isPending) return;
    recordMutation.reset();
    setAirline('');
    setFlightNumber('');
    setSector('');
    setFlightDate('');
    setTicket(null);
    setTicketError(null);
    setRecordKey(null);
    setStaleNotice(false);
    setRecordDialogOpen(true);
  }, [recordMutation]);

  const closeRecordDialog = useCallback(() => {
    if (recordMutation.isPending) return;
    setRecordDialogOpen(false);
    setRecordKey(null);
  }, [recordMutation]);

  const selectTicket = useCallback((nextFile: File | null) => {
    setTicket(nextFile);
    setTicketError(null);
  }, []);

  const submitRecord = useCallback(
    (expectedCurrentStageCode: string | undefined, note?: string) => {
      if (!candidateId || recordMutation.isPending) return;
      if (!ticket) {
        setTicketError('FILE_REQUIRED');
        return;
      }

      const selection: FlightDetailSelection = {
        candidateId,
        airline,
        flightNumber,
        sector,
        flightDate,
        ticketSignature: fileSignature(ticket),
        expectedCurrentStageCode,
      };
      const key = sameFlightDetailSelection(recordKey?.selection ?? null, selection)
        ? (recordKey as { key: string; selection: FlightDetailSelection }).key
        : randomIdempotencyKey('admin-flight-detail');
      setRecordKey({ key, selection });
      recordMutation.mutate({ formData: buildFlightDetailFormData(selection, ticket, note), idempotencyKey: key });
    },
    [candidateId, airline, flightNumber, sector, flightDate, ticket, recordKey, recordMutation]
  );

  const openMobilizeDialog = useCallback(() => {
    if (mobilizeMutation.isPending) return;
    mobilizeMutation.reset();
    setMobilizedOn('');
    setMobilizeKey(null);
    setStaleNotice(false);
    setMobilizeDialogOpen(true);
  }, [mobilizeMutation]);

  const closeMobilizeDialog = useCallback(() => {
    if (mobilizeMutation.isPending) return;
    setMobilizeDialogOpen(false);
    setMobilizeKey(null);
  }, [mobilizeMutation]);

  const submitMobilize = useCallback(
    (expectedCurrentStageCode: string | undefined, note?: string) => {
      if (!candidateId || mobilizeMutation.isPending) return;

      const selection: MobilizeSelection = { candidateId, mobilizedOn, expectedCurrentStageCode };
      const key = sameMobilizeSelection(mobilizeKey?.selection ?? null, selection)
        ? (mobilizeKey as { key: string; selection: MobilizeSelection }).key
        : randomIdempotencyKey('admin-mobilize');
      setMobilizeKey({ key, selection });
      mobilizeMutation.mutate({ ...selection, note, idempotencyKey: key });
    },
    [candidateId, mobilizedOn, mobilizeKey, mobilizeMutation]
  );

  const dismissStaleNotice = useCallback(() => setStaleNotice(false), []);

  const requestTicketAccess = useCallback(() => {
    if (!candidateId) return;
    void ticketAccess.requestAccess(() => adminWorkflowClient.getFlightTicketAccess(candidateId));
  }, [candidateId, ticketAccess]);

  return {
    recordDialogOpen,
    openRecordDialog,
    closeRecordDialog,
    airline,
    setAirline,
    flightNumber,
    setFlightNumber,
    sector,
    setSector,
    flightDate,
    setFlightDate,
    ticket,
    selectTicket,
    ticketError,
    submitRecord,
    recordMutation,
    mobilizeDialogOpen,
    openMobilizeDialog,
    closeMobilizeDialog,
    mobilizedOn,
    setMobilizedOn,
    submitMobilize,
    mobilizeMutation,
    staleNotice,
    dismissStaleNotice,
    ticketAccess,
    requestTicketAccess,
  };
}

// Real WorkflowCorrectionsClient (see ./types.ts for the endpoints). Same error
// handling as realAdminQvcAppointmentSettingClient.ts; no Idempotency-Key (a
// repeat of the same change is refused as "nothing changed").
import type { ApiClient, ApiError } from '../api-client';
import type { StaffAuthClient, StaffAuthError } from '../auth/staffTypes';
import type {
  AppointmentCorrectionInput,
  AppointmentValues,
  FlightCorrectionInput,
  FlightValues,
  QvcAppointmentValues,
  VisaCopyCorrectionInput,
  VisaCopyValues,
  WorkflowCorrectionBlockedReason,
  WorkflowCorrectionBox,
  WorkflowCorrectionChange,
  WorkflowCorrectionError,
  WorkflowCorrections,
  WorkflowCorrectionsClient,
} from './types';

type Raw = Record<string, unknown>;

export interface RealWorkflowCorrectionsClientOptions {
  apiClient: ApiClient;
  staffAuthClient: StaffAuthClient;
  /** Read fresh on every call so a language switch is reflected immediately. */
  getLocale: () => 'en' | 'ur';
}

const BLOCKED_REASONS: WorkflowCorrectionBlockedReason[] = [
  'not_recorded',
  'past_medical',
  'qvc_result_recorded',
  'mobilized',
  'visa_rejected',
];

const text = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);
const object = (value: unknown): Raw => (value && typeof value === 'object' ? (value as Raw) : {});

function toChange(raw: unknown): WorkflowCorrectionChange {
  const value = object(raw);
  const actor = object(value.actor);
  return {
    occurredAt: text(value.occurred_at) ?? '',
    reason: text(value.reason),
    changes: object(value.changes) as Record<string, [unknown, unknown]>,
    smsRequested: value.sms_requested === true,
    actor: text(actor.id) ? { id: actor.id as string, role: text(actor.role) ?? '' } : null,
  };
}

function toBox<Values>(raw: unknown, toValues: (values: Raw) => Values): WorkflowCorrectionBox<Values> {
  const value = object(raw);
  const blocked = BLOCKED_REASONS.find((reason) => reason === value.blocked_reason) ?? null;
  return {
    values: toValues(object(value.values)),
    editable: value.editable === true,
    blockedReason: value.editable === true ? null : (blocked ?? 'not_recorded'),
    recentChanges: Array.isArray(value.recent_changes) ? value.recent_changes.map(toChange) : [],
  };
}

function toAppointment(values: Raw): AppointmentValues {
  return {
    centerName: text(values.center_name),
    centerAddress: text(values.center_address),
    appointmentDate: text(values.appointment_date),
    appointmentTime: text(values.appointment_time),
  };
}

function toQvcAppointment(values: Raw): QvcAppointmentValues {
  return { ...toAppointment(values), attemptNumber: typeof values.attempt_number === 'number' ? values.attempt_number : null };
}

function toFlight(values: Raw): FlightValues {
  return {
    airline: text(values.airline),
    flightNumber: text(values.flight_number),
    sector: text(values.sector),
    flightDate: text(values.flight_date),
    hasTicket: values.has_ticket === true,
  };
}

function toVisaCopy(values: Raw): VisaCopyValues {
  const outcome = values.outcome_code;
  return {
    outcomeCode: outcome === 'issued' || outcome === 'rejected' ? outcome : null,
    decisionDate: text(values.decision_date),
    hasVisaCopy: values.has_visa_copy === true,
    visaCopyStored: typeof values.visa_copy_stored === 'boolean' ? values.visa_copy_stored : null,
  };
}

function toCorrections(raw: unknown): WorkflowCorrections {
  const value = object(raw);
  return {
    candidateId: text(value.candidate_id) ?? '',
    medicalAppointment: toBox(value.medical_appointment, toAppointment),
    qvcAppointment: toBox(value.qvc_appointment, toQvcAppointment),
    flightDetail: toBox(value.flight_detail, toFlight),
    visaCopy: toBox(value.visa_copy, toVisaCopy),
  };
}

/** A StaffAuthError (from authenticatedDataRequest's own refresh path) has no `status`. */
function isStaffAuthError(error: unknown): error is StaffAuthError {
  return !!error && typeof error === 'object' && 'code' in error && !('status' in error);
}

function toCorrectionError(error: unknown): WorkflowCorrectionError {
  if (isStaffAuthError(error)) {
    if (error.code === 'SESSION_EXPIRED' || error.code === 'NETWORK_ERROR' || error.code === 'OFFLINE') return { code: error.code };
    return { code: 'UNKNOWN' };
  }
  const apiError = error as ApiError;
  if (!apiError || typeof apiError !== 'object' || !('code' in apiError)) return { code: 'UNKNOWN' };
  if (apiError.code === 'OFFLINE') return { code: 'OFFLINE' };
  if (apiError.code === 'NETWORK_ERROR' || apiError.code === 'TIMEOUT') return { code: 'NETWORK_ERROR' };
  if (apiError.status === 403) {
    return { code: apiError.serverCode === 'inactive_account' ? 'INACTIVE_ACCOUNT' : 'FORBIDDEN', message: apiError.message };
  }
  if (apiError.status === 422) return { code: 'VALIDATION_FAILED', message: apiError.message, field: apiError.field };
  if (apiError.status >= 500) return { code: 'SERVER_ERROR' };
  return { code: 'UNKNOWN', message: apiError.message };
}

function appointmentBody(input: AppointmentCorrectionInput) {
  return {
    workflow_correction: {
      reason: input.reason.trim(),
      notify_candidate: input.notifyCandidate,
      center_name: input.centerName.trim(),
      center_address: input.centerAddress.trim(),
      appointment_date: input.appointmentDate,
      appointment_time: input.appointmentTime,
    },
  };
}

function flightBody(input: FlightCorrectionInput): FormData {
  const form = new FormData();
  form.append('workflow_correction[reason]', input.reason.trim());
  form.append('workflow_correction[notify_candidate]', String(input.notifyCandidate));
  form.append('workflow_correction[airline]', input.airline.trim());
  form.append('workflow_correction[flight_number]', input.flightNumber.trim());
  form.append('workflow_correction[sector]', input.sector.trim());
  form.append('workflow_correction[flight_date]', input.flightDate);
  if (input.ticket) form.append('workflow_correction[ticket]', input.ticket);
  return form;
}

function visaCopyBody(input: VisaCopyCorrectionInput): FormData {
  const form = new FormData();
  form.append('workflow_correction[reason]', input.reason.trim());
  form.append('workflow_correction[visa_copy]', input.visaCopy);
  return form;
}

export function createWorkflowCorrectionsClient(options: RealWorkflowCorrectionsClientOptions): WorkflowCorrectionsClient {
  const { apiClient, staffAuthClient, getLocale } = options;
  const headers = (token: string) => ({ Authorization: `Bearer ${token}`, 'X-Locale': getLocale() });
  const path = (candidateId: string, action = '') =>
    `/admin/candidates/${encodeURIComponent(candidateId)}/workflow_corrections${action ? `/${action}` : ''}`;

  async function call(request: (token: string) => Promise<unknown>): Promise<WorkflowCorrections> {
    try {
      const data = await staffAuthClient.authenticatedDataRequest(request);
      if (!data) throw { code: 'UNKNOWN' } satisfies WorkflowCorrectionError;
      return toCorrections(data);
    } catch (error) {
      throw toCorrectionError(error);
    }
  }

  return {
    getCorrections: (candidateId) => call((token) => apiClient.get<Raw>(path(candidateId), { headers: headers(token) })),
    correctMedicalAppointment: (input) =>
      call((token) => apiClient.patch<Raw>(path(input.candidateId, 'medical_appointment'), appointmentBody(input), { headers: headers(token) })),
    correctQvcAppointment: (input) =>
      call((token) => apiClient.patch<Raw>(path(input.candidateId, 'qvc_appointment'), appointmentBody(input), { headers: headers(token) })),
    correctFlightDetail: (input) =>
      call((token) => apiClient.patch<Raw>(path(input.candidateId, 'flight_detail'), flightBody(input), { headers: headers(token) })),
    correctVisaCopy: (input) =>
      call((token) => apiClient.patch<Raw>(path(input.candidateId, 'visa_copy'), visaCopyBody(input), { headers: headers(token) })),
  };
}

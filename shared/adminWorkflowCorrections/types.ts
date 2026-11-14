// Developer-only corrections of a candidate's recorded medical appointment,
// QVC appointment and flight details, from the candidate page's Overview tab.
// Backend (descon-be's openapi.yaml):
//   GET   /api/v1/admin/candidates/:id/workflow_corrections
//   PATCH /api/v1/admin/candidates/:id/workflow_corrections/medical_appointment
//   PATCH /api/v1/admin/candidates/:id/workflow_corrections/qvc_appointment
//   PATCH /api/v1/admin/candidates/:id/workflow_corrections/flight_detail
// Each change keeps the candidate at the same stage, needs a reason, is audited,
// and texts the candidate unless `notifyCandidate` is false. Web-only.

export type WorkflowCorrectionKind = 'medicalAppointment' | 'qvcAppointment' | 'flightDetail';

/** Why a box cannot be changed right now; null when it can. */
export type WorkflowCorrectionBlockedReason = 'not_recorded' | 'past_medical' | 'qvc_result_recorded' | 'mobilized';

export interface WorkflowCorrectionChange {
  occurredAt: string;
  reason: string | null;
  /** field -> [old, new] */
  changes: Record<string, [unknown, unknown]>;
  smsRequested: boolean;
  actor: { id: string; role: string } | null;
}

export interface WorkflowCorrectionBox<Values> {
  values: Values;
  editable: boolean;
  blockedReason: WorkflowCorrectionBlockedReason | null;
  recentChanges: WorkflowCorrectionChange[];
}

export interface AppointmentValues {
  centerName: string | null;
  centerAddress: string | null;
  /** YYYY-MM-DD */
  appointmentDate: string | null;
  /** HH:MM, Pakistan time */
  appointmentTime: string | null;
}

export interface QvcAppointmentValues extends AppointmentValues {
  attemptNumber: number | null;
}

export interface FlightValues {
  airline: string | null;
  flightNumber: string | null;
  sector: string | null;
  /** ISO 8601 with the Pakistan offset, e.g. 2026-12-10T14:30:00+05:00 */
  flightDate: string | null;
  hasTicket: boolean;
}

export interface WorkflowCorrections {
  candidateId: string;
  medicalAppointment: WorkflowCorrectionBox<AppointmentValues>;
  qvcAppointment: WorkflowCorrectionBox<QvcAppointmentValues>;
  flightDetail: WorkflowCorrectionBox<FlightValues>;
}

interface CorrectionCommon {
  candidateId: string;
  reason: string;
  notifyCandidate: boolean;
}

export interface AppointmentCorrectionInput extends CorrectionCommon {
  centerName: string;
  centerAddress: string;
  appointmentDate: string;
  appointmentTime: string;
}

export interface FlightCorrectionInput extends CorrectionCommon {
  airline: string;
  flightNumber: string;
  sector: string;
  /** Local Pakistan date and time, YYYY-MM-DDTHH:MM. */
  flightDate: string;
  ticket?: File | null;
}

export type WorkflowCorrectionErrorCode =
  | 'VALIDATION_FAILED'
  | 'FORBIDDEN'
  | 'INACTIVE_ACCOUNT'
  | 'SESSION_EXPIRED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface WorkflowCorrectionError {
  code: WorkflowCorrectionErrorCode;
  /** Already-localized server message, when the backend provided one. */
  message?: string;
  field?: string;
}

export interface WorkflowCorrectionsClient {
  getCorrections(candidateId: string): Promise<WorkflowCorrections>;
  correctMedicalAppointment(input: AppointmentCorrectionInput): Promise<WorkflowCorrections>;
  correctQvcAppointment(input: AppointmentCorrectionInput): Promise<WorkflowCorrections>;
  correctFlightDetail(input: FlightCorrectionInput): Promise<WorkflowCorrections>;
}

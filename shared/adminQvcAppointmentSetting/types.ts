// Admin default QVC appointment types, wired to the real backend documented
// in descon-be's openapi.yaml:
//   GET   /api/v1/admin/qvc_appointment_setting
//   PATCH /api/v1/admin/qvc_appointment_setting
//
// The centre, address, date and time filled in when staff book a candidate's QVC
// appointment. Each booking saves its own copy for that candidate, so changing
// these only affects bookings made afterwards. Web-only.

export interface QvcAppointmentSettingActorRef {
  id: string;
  role: string;
}

export interface AdminQvcAppointmentSetting {
  centerName: string | null;
  centerAddress: string | null;
  /** YYYY-MM-DD. */
  appointmentOn: string | null;
  /** HH:MM, 24-hour. */
  appointmentTime: string | null;
  updatedBy?: QvcAppointmentSettingActorRef;
  updatedAt: string;
}

/** Blank values clear that default. */
export interface AdminQvcAppointmentSettingUpdateInput {
  centerName: string;
  centerAddress: string;
  appointmentOn: string;
  appointmentTime: string;
}

export type AdminQvcAppointmentSettingErrorCode =
  | 'VALIDATION_FAILED'
  | 'FORBIDDEN'
  | 'INACTIVE_ACCOUNT'
  | 'SESSION_EXPIRED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface AdminQvcAppointmentSettingError {
  code: AdminQvcAppointmentSettingErrorCode;
  /** Already-localized server message, when the backend provided one. */
  message?: string;
  field?: string;
}

export interface AdminQvcAppointmentSettingClient {
  getQvcAppointmentSetting(): Promise<AdminQvcAppointmentSetting>;
  updateQvcAppointmentSetting(input: AdminQvcAppointmentSettingUpdateInput): Promise<AdminQvcAppointmentSetting>;
}

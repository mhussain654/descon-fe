// Admin default medical appointment types, wired to the real backend documented
// in descon-be's openapi.yaml:
//   GET   /api/v1/admin/medical_appointment_setting
//   PATCH /api/v1/admin/medical_appointment_setting
//
// The centre, address, date and time filled in when staff move a candidate into
// a medical appointment stage. Each move saves its own copy for that candidate,
// so changing these only affects candidates moved afterwards. Web-only.

export interface MedicalAppointmentSettingActorRef {
  id: string;
  role: string;
}

export interface AdminMedicalAppointmentSetting {
  centerName: string | null;
  centerAddress: string | null;
  /** YYYY-MM-DD. */
  appointmentOn: string | null;
  /** HH:MM, 24-hour. */
  appointmentTime: string | null;
  updatedBy?: MedicalAppointmentSettingActorRef;
  updatedAt: string;
}

/** Blank values clear that default. */
export interface AdminMedicalAppointmentSettingUpdateInput {
  centerName: string;
  centerAddress: string;
  appointmentOn: string;
  appointmentTime: string;
}

export type AdminMedicalAppointmentSettingErrorCode =
  | 'VALIDATION_FAILED'
  | 'FORBIDDEN'
  | 'INACTIVE_ACCOUNT'
  | 'SESSION_EXPIRED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface AdminMedicalAppointmentSettingError {
  code: AdminMedicalAppointmentSettingErrorCode;
  /** Already-localized server message, when the backend provided one. */
  message?: string;
  field?: string;
}

export interface AdminMedicalAppointmentSettingClient {
  getMedicalAppointmentSetting(): Promise<AdminMedicalAppointmentSetting>;
  updateMedicalAppointmentSetting(input: AdminMedicalAppointmentSettingUpdateInput): Promise<AdminMedicalAppointmentSetting>;
}

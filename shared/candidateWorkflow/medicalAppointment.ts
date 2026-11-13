// The candidate's medical appointment -- centre, address, date and time -- as
// staff saved it when moving them into a medical appointment stage. Read from
// that move's history entry, so it never changes when the admin's defaults do.
import type { WorkflowHistoryItem } from './types';

/** The medical appointment stages across every mobilization process. */
export const MEDICAL_APPOINTMENT_STAGE_CODES = new Set(['medical_pending', 'medical_appointment', 'gamca_medical_pending']);

export interface MedicalAppointment {
  centerName?: string;
  centerAddress?: string;
  /** YYYY-MM-DD. */
  date?: string;
  /** HH:MM, 24-hour. */
  time?: string;
}

/** The latest move into a medical appointment stage that recorded any detail, or null. */
export function findLatestMedicalAppointment(items: WorkflowHistoryItem[]): MedicalAppointment | null {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (!MEDICAL_APPOINTMENT_STAGE_CODES.has(item.toStage.code)) continue;

    const details = item.details;
    const appointment: MedicalAppointment = {
      centerName: details?.medicalCenterName,
      centerAddress: details?.medicalCenterAddress,
      date: details?.medicalAppointmentDate,
      time: details?.medicalAppointmentTime,
    };
    if (Object.values(appointment).some((value) => value !== undefined)) return appointment;
  }
  return null;
}

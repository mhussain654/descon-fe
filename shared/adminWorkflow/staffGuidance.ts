import type { TranslationKey } from '../i18n/translations';

/**
 * Plain-language guidance for staff on the candidate workflow panel: what to do
 * while a candidate sits at a stage, and what completing a stage means. Keyed by
 * backend workflow-stage code; a code with no entry shows no guidance (current
 * stage) or the generic description (transition).
 */
const CURRENT_STAGE_GUIDANCE_KEYS: Record<string, TranslationKey> = {
  registered: 'adminWorkflowGuidanceNowRegistered',
  documents_pending: 'adminWorkflowGuidanceNowDocumentsPending',
  documents_uploaded: 'adminWorkflowGuidanceNowDocumentsUploaded',
  under_verification: 'adminWorkflowGuidanceNowUnderVerification',
  verified: 'adminWorkflowGuidanceNowVerified',
  campaign_nomination: 'adminWorkflowGuidanceNowCampaignNomination',
  medical_pending: 'adminWorkflowGuidanceNowMedicalBooked',
  medical_appointment: 'adminWorkflowGuidanceNowMedicalBooked',
  gamca_medical_pending: 'adminWorkflowGuidanceNowMedicalBooked',
  medical_completed: 'adminWorkflowGuidanceNowMedicalDone',
  medical_fit: 'adminWorkflowGuidanceNowMedicalDone',
  gamca_medical_completed: 'adminWorkflowGuidanceNowMedicalDone',
  fee_pending: 'adminWorkflowGuidanceNowFeePending',
  fee_paid: 'adminWorkflowGuidanceNowFeePaid',
  e_number_processing: 'adminWorkflowGuidanceNowENumberProcessing',
  e_number_requested: 'adminWorkflowGuidanceNowENumberRequested',
  e_number_received: 'adminWorkflowGuidanceNowENumberReceived',
  biometric_completed: 'adminWorkflowGuidanceNowBiometricCompleted',
  visa_stamping_case_prepared: 'adminWorkflowGuidanceNowVisaCasePrepared',
  visa_stamping_case_sent: 'adminWorkflowGuidanceNowAwaitingVisa',
  visa_processing: 'adminWorkflowGuidanceNowAwaitingVisa',
  documents_shared_with_qatar_bu: 'adminWorkflowGuidanceNowDocumentsSharedWithQatarBu',
  qvc_appointment_booked: 'adminWorkflowGuidanceNowQvcAppointmentBooked',
  qvc_completed_outcome_received: 'adminWorkflowGuidanceNowAwaitingVisa',
  visa_issued_or_rejected: 'adminWorkflowGuidanceNowVisaReceived',
  protection_call: 'adminWorkflowGuidanceNowProtectionCall',
  appeared_for_protection: 'adminWorkflowGuidanceNowAppearedForProtection',
  ticket_handover: 'adminWorkflowGuidanceNowTicketHandover',
  flight_details_uploaded: 'adminWorkflowGuidanceNowFlightDetailsUploaded',
  mobilized: 'adminWorkflowGuidanceNowMobilized',
};

const TRANSITION_GUIDANCE_KEYS: Record<string, TranslationKey> = {
  medical_pending: 'adminWorkflowGuidanceToMedicalBooked',
  medical_appointment: 'adminWorkflowGuidanceToMedicalBooked',
  gamca_medical_pending: 'adminWorkflowGuidanceToMedicalBooked',
  medical_completed: 'adminWorkflowGuidanceToMedicalResult',
  medical_fit: 'adminWorkflowGuidanceToMedicalResult',
  gamca_medical_completed: 'adminWorkflowGuidanceToMedicalResult',
  e_number_processing: 'adminWorkflowGuidanceToENumberProcessing',
  e_number_requested: 'adminWorkflowGuidanceToENumberRequested',
  e_number_received: 'adminWorkflowGuidanceToENumberReceived',
  biometric_completed: 'adminWorkflowGuidanceToBiometricCompleted',
  visa_stamping_case_prepared: 'adminWorkflowGuidanceToVisaCasePrepared',
  visa_stamping_case_sent: 'adminWorkflowGuidanceToVisaCaseSent',
  visa_processing: 'adminWorkflowGuidanceToVisaProcessing',
  protection_call: 'adminWorkflowGuidanceToProtectionCall',
  ticket_handover: 'adminWorkflowGuidanceToTicketHandover',
};

/** What staff should do while the candidate is at this stage, or undefined when there is nothing to say. */
export function currentStageGuidanceKey(stageCode: string | undefined): TranslationKey | undefined {
  return stageCode ? CURRENT_STAGE_GUIDANCE_KEYS[stageCode] : undefined;
}

/** What completing this stage means and when to do it; the generic description for a stage without its own. */
export function transitionGuidanceKey(stageCode: string): TranslationKey {
  return TRANSITION_GUIDANCE_KEYS[stageCode] ?? 'adminWorkflowGenericTransitionDescription';
}

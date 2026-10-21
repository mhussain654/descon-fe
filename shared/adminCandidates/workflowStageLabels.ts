import { WORKFLOW_STAGE_LABEL_KEYS } from '../adminWorkflow/canonicalStages';
import type { TranslationKey } from '../i18n/translations';

/** Backend WorkflowStage catalog, including country-specific deployment stages. */
export const CANDIDATE_LIST_STAGE_LABEL_KEYS: Record<string, TranslationKey> = {
  ...WORKFLOW_STAGE_LABEL_KEYS,
  campaign_nomination: 'adminListStageCampaignNomination',
  medical_pending: 'adminListStageMedicalPending',
  medical_completed: 'adminListStageMedicalCompleted',
  medical_appointment: 'adminListStageMedicalAppointment',
  medical_fit: 'adminListStageMedicalFit',
  gamca_medical_pending: 'adminListStageGamcaMedicalPending',
  gamca_medical_completed: 'adminListStageGamcaMedicalCompleted',
  e_number_processing: 'adminListStageENumberProcessing',
  e_number_requested: 'adminListStageENumberRequested',
  e_number_received: 'adminListStageENumberReceived',
  biometric_completed: 'adminListStageBiometricCompleted',
  visa_stamping_case_prepared: 'adminListStageVisaStampingCasePrepared',
  visa_processing: 'adminListStageVisaProcessing',
  visa_stamping_case_sent: 'adminListStageVisaStampingCaseSent',
  protection_call: 'adminListStageProtectionCall',
  ticket_handover: 'adminListStageTicketHandover',
};

/** Every stage in the backend's own order (WorkflowStage::CANONICAL_STAGES positions), for lists that should read as the candidate's journey. */
export const ORDERED_WORKFLOW_STAGE_CODES = [
  'registered',
  'documents_pending',
  'documents_uploaded',
  'under_verification',
  'verified',
  'campaign_nomination',
  'medical_pending',
  'medical_completed',
  'medical_appointment',
  'medical_fit',
  'gamca_medical_pending',
  'gamca_medical_completed',
  'e_number_processing',
  'e_number_requested',
  'e_number_received',
  'biometric_completed',
  'visa_stamping_case_prepared',
  'fee_pending',
  'fee_paid',
  'documents_shared_with_qatar_bu',
  'qvc_appointment_booked',
  'qvc_completed_outcome_received',
  'visa_processing',
  'visa_stamping_case_sent',
  'visa_issued_or_rejected',
  'protection_call',
  'appeared_for_protection',
  'ticket_handover',
  'flight_details_uploaded',
  'mobilized',
] as const;

/** The translation key for a stage code, or undefined for a code this build does not know. */
export function workflowStageLabelKey(code: string): TranslationKey | undefined {
  return CANDIDATE_LIST_STAGE_LABEL_KEYS[code];
}

/** Sorts anything with a stage code into the journey order; an unknown code goes last. */
export function sortByWorkflowStageOrder<T>(items: readonly T[], codeOf: (item: T) => string): T[] {
  const order = (code: string) => {
    const index = (ORDERED_WORKFLOW_STAGE_CODES as readonly string[]).indexOf(code);
    return index === -1 ? ORDERED_WORKFLOW_STAGE_CODES.length : index;
  };
  return [...items].sort((a, b) => order(codeOf(a)) - order(codeOf(b)));
}

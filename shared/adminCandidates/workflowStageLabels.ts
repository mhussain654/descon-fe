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

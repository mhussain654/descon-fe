// The exact, stable workflow-stage code enum (WorkflowStage::CANONICAL_STAGES
// in descon-be -- system-defined seed data, protected from casual changes by
// the backend's own `protect_system_definition_changes` validation). There is
// no admin-facing list endpoint for workflow stages (unlike
// countries/projects/crafts, which really are editable reference data), so
// this mirrors the backend's own stable, versioned enum rather than
// inventing a client-side placeholder -- used to populate the candidate
// list's status filter, and any other UI that needs the full stage set
// independent of one candidate's own assignment.
import type { TranslationKey } from '../i18n/translations';

export const CANONICAL_WORKFLOW_STAGE_CODES = [
  'registered',
  'documents_pending',
  'documents_uploaded',
  'under_verification',
  'verified',
  'fee_pending',
  'fee_paid',
  'documents_shared_with_qatar_bu',
  'qvc_appointment_booked',
  'qvc_completed_outcome_received',
  'visa_issued_or_rejected',
  'appeared_for_protection',
  'protected_ready_to_fly',
  'flight_details_uploaded',
  'mobilized',
] as const;

export type CanonicalWorkflowStageCode = (typeof CANONICAL_WORKFLOW_STAGE_CODES)[number];

/** Distinct from shared/i18n/translations.ts's candidate-facing status-timeline keys (`registered`, `feePaid`, etc.) -- that set is a curated, coarser milestone list for the candidate's own Status screen, not a 1:1 mapping of every real stage code, so it isn't reused here. */
export const WORKFLOW_STAGE_LABEL_KEYS: Record<CanonicalWorkflowStageCode, TranslationKey> = {
  registered: 'adminWorkflowStageRegistered',
  documents_pending: 'adminWorkflowStageDocumentsPending',
  documents_uploaded: 'adminWorkflowStageDocumentsUploaded',
  under_verification: 'adminWorkflowStageUnderVerification',
  verified: 'adminWorkflowStageVerified',
  fee_pending: 'adminWorkflowStageFeePending',
  fee_paid: 'adminWorkflowStageFeePaid',
  documents_shared_with_qatar_bu: 'adminWorkflowStageDocumentsSharedWithQatarBu',
  qvc_appointment_booked: 'adminWorkflowStageQvcAppointmentBooked',
  qvc_completed_outcome_received: 'adminWorkflowStageQvcCompletedOutcomeReceived',
  visa_issued_or_rejected: 'adminWorkflowStageVisaIssuedOrRejected',
  appeared_for_protection: 'adminWorkflowStageAppearedForProtection',
  protected_ready_to_fly: 'adminWorkflowStageProtectedReadyToFly',
  flight_details_uploaded: 'adminWorkflowStageFlightDetailsUploaded',
  mobilized: 'adminWorkflowStageMobilized',
};

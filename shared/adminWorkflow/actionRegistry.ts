import type { WorkflowActionType } from './types';

export type WorkflowActionComponent =
  | 'qvc'
  | 'visa-decision'
  | 'flight-details'
  | 'mobilization'
  | 'generic-evidence'
  | 'generic-confirmation'
  | 'unsupported';

const REGISTRY: Record<WorkflowActionType, WorkflowActionComponent> = {
  qvc_appointment: 'qvc',
  qvc_outcome: 'qvc',
  visa_decision: 'visa-decision',
  flight_details: 'flight-details',
  mobilization: 'mobilization',
  medical_appointment: 'generic-evidence',
  medical_outcome: 'generic-evidence',
  protection_appearance: 'generic-evidence',
  protection_call: 'generic-evidence',
  e_number_request: 'generic-evidence',
  e_number_received: 'generic-evidence',
  biometric_completion: 'generic-evidence',
  ticket_handover: 'generic-evidence',
  none: 'generic-confirmation',
  document_submission: 'generic-confirmation',
  nomination: 'generic-confirmation',
  payment: 'generic-confirmation',
  e_number_processing: 'generic-confirmation',
  visa_case_preparation: 'generic-confirmation',
  visa_case_submission: 'generic-confirmation',
  visa_processing: 'generic-confirmation',
  unknown: 'unsupported',
};

export function componentForWorkflowAction(actionType: WorkflowActionType): WorkflowActionComponent {
  return REGISTRY[actionType];
}

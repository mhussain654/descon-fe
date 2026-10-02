import { describe, expect, it } from 'vitest';
import { componentForWorkflowAction } from '../../../../../../shared/adminWorkflow/actionRegistry';

describe('workflow action component registry', () => {
  it('routes dedicated resources by action type', () => {
    expect(componentForWorkflowAction('qvc_appointment')).toBe('qvc');
    expect(componentForWorkflowAction('visa_decision')).toBe('visa-decision');
    expect(componentForWorkflowAction('flight_details')).toBe('flight-details');
  });

  it('fails closed for unknown future actions', () => {
    expect(componentForWorkflowAction('unknown')).toBe('unsupported');
  });
});

// Runs under both web's Vitest and mobile's Jest (this module lives under
// shared/, which mobile's Jest config also roots into), matching the
// established adminDocumentReviews precedent -- even though the staff
// workflow-transition feature itself is web-only in Phase A.
import { createApiClient } from '../api-client';
import type { StaffAuthClient, StaffAuthError } from '../auth/staffTypes';
import { createAdminWorkflowClient } from './realAdminWorkflowClient';

const originalFetch = globalThis.fetch;
function stubFetch(impl: typeof fetch) {
  globalThis.fetch = impl as typeof fetch;
}
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function successEnvelope(data: unknown, meta: Record<string, unknown> = {}) {
  return { data, meta: { request_id: 'req-1', timestamp: '2026-08-30T09:00:00Z', ...meta }, errors: [] };
}

function errorEnvelope(errors: Array<{ code: string; message: string; field?: string; details?: Record<string, unknown> }>) {
  return { errors, request_id: 'req-1' };
}

function fakeStaffAuthClient(onFailure?: StaffAuthError): StaffAuthClient {
  return {
    signIn: async () => {
      throw new Error('not used');
    },
    restoreSession: async () => null,
    signOut: async () => undefined,
    authenticatedRequest: async () => {
      throw new Error('not used');
    },
    authenticatedDataRequest: async (makeRequest) => {
      if (onFailure) throw onFailure;
      return makeRequest('staff-access-token');
    },
  };
}

function buildClient(locale: 'en' | 'ur' = 'en', onFailure?: StaffAuthError) {
  const apiClient = createApiClient({ baseUrl: 'http://example.test/api/v1' });
  const staffAuthClient = fakeStaffAuthClient(onFailure);
  return createAdminWorkflowClient({ apiClient, staffAuthClient, getLocale: () => locale });
}

function timelineStageResponse(overrides: Record<string, unknown> = {}) {
  return { code: 'fee_paid', name: 'Fee Paid', position: 7, status: 'completed', completed_at: '2026-08-30T09:00:00Z', ...overrides };
}

function workflowStateResponse(overrides: Record<string, unknown> = {}) {
  return {
    candidate_id: 'candidate-1',
    assignment_id: 'assignment-1',
    candidate_status: 'fee_paid',
    current_stage: timelineStageResponse({ status: 'current', started_at: '2026-08-30T09:00:00Z', completed_at: null }),
    timeline: [timelineStageResponse()],
    completed_count: 7,
    total_count: 15,
    progress_percentage: 46,
    updated_at: '2026-08-30T09:00:00Z',
    ...overrides,
  };
}

function allowedTransitionResponse(overrides: Record<string, unknown> = {}) {
  return {
    code: 'documents_shared_with_qatar_bu',
    name: 'Documents Shared with Qatar BU',
    position: 8,
    required_fields: [],
    allowed: true,
    blocking_reasons: [],
    ...overrides,
  };
}

function historyItemResponse(overrides: Record<string, unknown> = {}) {
  return {
    from_stage: { code: 'fee_paid', name: 'Fee Paid', position: 7 },
    to_stage: { code: 'documents_shared_with_qatar_bu', name: 'Documents Shared with Qatar BU', position: 8 },
    occurred_at: '2026-08-30T09:00:00Z',
    reason_code: 'qatar_bu_shared',
    details: null,
    actor: { id: 'staff-1', role: 'mps' },
    ...overrides,
  };
}

describe('createAdminWorkflowClient (real)', () => {
  describe('getWorkflowState', () => {
    it('maps the workflow state, including current stage and timeline', async () => {
      let capturedUrl: string | undefined;
      let capturedHeaders: Record<string, string> | undefined;
      stubFetch(async (url, init) => {
        capturedUrl = String(url);
        capturedHeaders = init?.headers as Record<string, string>;
        return jsonResponse(successEnvelope(workflowStateResponse()));
      });
      const client = buildClient();

      const result = await client.getWorkflowState('candidate-1');

      expect(capturedUrl).toContain('/admin/candidates/candidate-1/workflow_state');
      expect(capturedHeaders?.Authorization).toBe('Bearer staff-access-token');
      expect(result.candidateId).toBe('candidate-1');
      expect(result.currentStage).toEqual({
        code: 'fee_paid',
        name: 'Fee Paid',
        position: 7,
        status: 'current',
        startedAt: '2026-08-30T09:00:00Z',
        completedAt: undefined,
      });
      expect(result.completedCount).toBe(7);
      expect(result.totalCount).toBe(15);
      expect(result.progressPercentage).toBe(46);
    });

    it('maps a null current_stage and empty timeline safely', async () => {
      stubFetch(async () => jsonResponse(successEnvelope(workflowStateResponse({ current_stage: null, timeline: [] }))));
      const client = buildClient();

      const result = await client.getWorkflowState('candidate-1');

      expect(result.currentStage).toBeNull();
      expect(result.timeline).toEqual([]);
    });

    it('URL-encodes the candidate id', async () => {
      let capturedUrl: string | undefined;
      stubFetch(async (url) => {
        capturedUrl = String(url);
        return jsonResponse(successEnvelope(workflowStateResponse()));
      });
      const client = buildClient();

      await client.getWorkflowState('candidate/needs encoding');

      expect(capturedUrl).toContain(encodeURIComponent('candidate/needs encoding'));
    });

    it('maps a present protection record', async () => {
      stubFetch(async () =>
        jsonResponse(
          successEnvelope(
            workflowStateResponse({
              protection: {
                id: 'protection-1',
                appeared_on: '2026-09-01',
                appeared_recorded_at: '2026-09-01T10:00:00Z',
                protected_on: null,
                ready_to_fly_at: null,
              },
            })
          )
        )
      );
      const client = buildClient();

      const result = await client.getWorkflowState('candidate-1');

      expect(result.protection).toEqual({
        id: 'protection-1',
        appearedOn: '2026-09-01',
        appearedRecordedAt: '2026-09-01T10:00:00Z',
        protectedOn: null,
        readyToFlyAt: null,
      });
    });

    it('maps a missing protection to null rather than crashing', async () => {
      stubFetch(async () => jsonResponse(successEnvelope(workflowStateResponse({ protection: null }))));
      const client = buildClient();

      const result = await client.getWorkflowState('candidate-1');

      expect(result.protection).toBeNull();
    });
  });

  describe('getAllowedTransitions', () => {
    it('maps allowed and blocked transitions', async () => {
      stubFetch(async () =>
        jsonResponse(
          successEnvelope({
            candidate_id: 'candidate-1',
            updated_at: '2026-08-30T09:00:00Z',
            allowed_next_transitions: [
              allowedTransitionResponse(),
              allowedTransitionResponse({
                code: 'qvc_appointment_booked',
                position: 9,
                allowed: false,
                blocking_reasons: ['payment_required'],
              }),
            ],
          })
        )
      );
      const client = buildClient();

      const result = await client.getAllowedTransitions('candidate-1');

      expect(result.allowedNextTransitions).toHaveLength(2);
      expect(result.allowedNextTransitions[0]).toEqual({
        code: 'documents_shared_with_qatar_bu',
        name: 'Documents Shared with Qatar BU',
        position: 8,
        requiredFields: [],
        allowed: true,
        blockingReasons: [],
      });
      expect(result.allowedNextTransitions[1].blockingReasons).toEqual(['payment_required']);
    });

    it('falls back to an empty list for a malformed response', async () => {
      stubFetch(async () => jsonResponse(successEnvelope({ candidate_id: 'candidate-1', updated_at: null })));
      const client = buildClient();

      const result = await client.getAllowedTransitions('candidate-1');

      expect(result.allowedNextTransitions).toEqual([]);
    });
  });

  describe('getWorkflowHistory', () => {
    it('maps history items including the actor', async () => {
      stubFetch(async () =>
        jsonResponse(
          successEnvelope({
            candidate_id: 'candidate-1',
            assignment_id: 'assignment-1',
            history: [historyItemResponse()],
            updated_at: '2026-08-30T09:00:00Z',
          })
        )
      );
      const client = buildClient();

      const result = await client.getWorkflowHistory('candidate-1');

      expect(result.history).toHaveLength(1);
      expect(result.history[0].actor).toEqual({ id: 'staff-1', role: 'mps' });
      expect(result.history[0].fromStage).toEqual({ code: 'fee_paid', name: 'Fee Paid', position: 7 });
      expect(result.history[0].toStage.code).toBe('documents_shared_with_qatar_bu');
    });

    it('maps an unrecognized actor role to "unknown" rather than displaying the raw code', async () => {
      stubFetch(async () =>
        jsonResponse(
          successEnvelope({
            candidate_id: 'candidate-1',
            assignment_id: 'assignment-1',
            history: [historyItemResponse({ actor: { id: 'staff-1', role: 'some_future_role' } })],
            updated_at: '2026-08-30T09:00:00Z',
          })
        )
      );
      const client = buildClient();

      const result = await client.getWorkflowHistory('candidate-1');

      expect(result.history[0].actor).toEqual({ id: 'staff-1', role: 'unknown' });
    });

    it('never maps an actor name or email -- only id and role', async () => {
      stubFetch(async () =>
        jsonResponse(
          successEnvelope({
            candidate_id: 'candidate-1',
            assignment_id: 'assignment-1',
            history: [historyItemResponse({ actor: { id: 'staff-1', role: 'mps', name: 'Should Not Appear', email: 'nope@example.test' } })],
            updated_at: '2026-08-30T09:00:00Z',
          })
        )
      );
      const client = buildClient();

      const result = await client.getWorkflowHistory('candidate-1');

      expect(result.history[0].actor).toEqual({ id: 'staff-1', role: 'mps' });
    });

    it('drops a malformed history item rather than crashing', async () => {
      stubFetch(async () =>
        jsonResponse(
          successEnvelope({
            candidate_id: 'candidate-1',
            assignment_id: 'assignment-1',
            history: [{ occurred_at: '2026-08-30T09:00:00Z' }, historyItemResponse()],
            updated_at: '2026-08-30T09:00:00Z',
          })
        )
      );
      const client = buildClient();

      const result = await client.getWorkflowHistory('candidate-1');

      expect(result.history).toHaveLength(1);
    });
  });

  describe('submitTransition', () => {
    it('sends the documented request body shape and the Idempotency-Key header', async () => {
      let capturedBody: string | undefined;
      let capturedHeaders: Record<string, string> | undefined;
      let capturedUrl: string | undefined;
      stubFetch(async (url, init) => {
        capturedUrl = String(url);
        capturedBody = init?.body as string;
        capturedHeaders = init?.headers as Record<string, string>;
        return jsonResponse(
          successEnvelope({ workflow: workflowStateResponse(), transition: historyItemResponse() }),
          { status: 201 }
        );
      });
      const client = buildClient();

      const result = await client.submitTransition({
        candidateId: 'candidate-1',
        toStageCode: 'documents_shared_with_qatar_bu',
        expectedCurrentStageCode: 'fee_paid',
        idempotencyKey: 'idem-key-1',
      });

      expect(capturedUrl).toContain('/admin/candidates/candidate-1/workflow_transitions');
      expect(capturedHeaders?.['Idempotency-Key']).toBe('idem-key-1');
      expect(JSON.parse(capturedBody!)).toEqual({
        candidate_workflow_transition: {
          to_stage_code: 'documents_shared_with_qatar_bu',
          expected_current_stage_code: 'fee_paid',
        },
      });
      expect(result.workflow.candidateId).toBe('candidate-1');
      expect(result.transition.actor).toEqual({ id: 'staff-1', role: 'mps' });
    });

    it('omits expected_current_stage_code from the body when not provided', async () => {
      let capturedBody: string | undefined;
      stubFetch(async (_url, init) => {
        capturedBody = init?.body as string;
        return jsonResponse(successEnvelope({ workflow: workflowStateResponse(), transition: historyItemResponse() }), {
          status: 201,
        });
      });
      const client = buildClient();

      await client.submitTransition({
        candidateId: 'candidate-1',
        toStageCode: 'documents_shared_with_qatar_bu',
        idempotencyKey: 'idem-key-1',
      });

      expect(JSON.parse(capturedBody!)).toEqual({
        candidate_workflow_transition: { to_stage_code: 'documents_shared_with_qatar_bu' },
      });
    });

    it('includes evidence in the body when provided (e.g. the Protection panel)', async () => {
      let capturedBody: string | undefined;
      stubFetch(async (_url, init) => {
        capturedBody = init?.body as string;
        return jsonResponse(successEnvelope({ workflow: workflowStateResponse(), transition: historyItemResponse() }), {
          status: 201,
        });
      });
      const client = buildClient();

      await client.submitTransition({
        candidateId: 'candidate-1',
        toStageCode: 'appeared_for_protection',
        expectedCurrentStageCode: 'qvc_completed_outcome_received',
        evidence: { appeared_for_protection_on: '2026-09-10' },
        idempotencyKey: 'idem-key-1',
      });

      expect(JSON.parse(capturedBody!)).toEqual({
        candidate_workflow_transition: {
          to_stage_code: 'appeared_for_protection',
          expected_current_stage_code: 'qvc_completed_outcome_received',
          evidence: { appeared_for_protection_on: '2026-09-10' },
        },
      });
    });

    it('omits evidence from the body when empty or undefined', async () => {
      let capturedBody: string | undefined;
      stubFetch(async (_url, init) => {
        capturedBody = init?.body as string;
        return jsonResponse(successEnvelope({ workflow: workflowStateResponse(), transition: historyItemResponse() }), {
          status: 201,
        });
      });
      const client = buildClient();

      await client.submitTransition({
        candidateId: 'candidate-1',
        toStageCode: 'documents_shared_with_qatar_bu',
        evidence: {},
        idempotencyKey: 'idem-key-1',
      });

      expect(JSON.parse(capturedBody!)).toEqual({
        candidate_workflow_transition: { to_stage_code: 'documents_shared_with_qatar_bu' },
      });
    });
  });

  describe('getQvcAttempts', () => {
    function qvcAttemptResponse(overrides: Record<string, unknown> = {}) {
      return {
        id: 'qvc-attempt-1',
        attempt_number: 1,
        appointment_date: '2026-09-01',
        outcome_code: null,
        no_show: false,
        outcome_recorded_at: null,
        status: 'scheduled',
        internal_note: null,
        scheduled_by: { id: 'staff-1', role: 'mps' },
        outcome_recorded_by: null,
        ...overrides,
      };
    }

    it('maps the attempts collection, including scheduled_by and outcome_recorded_by', async () => {
      let capturedUrl: string | undefined;
      stubFetch(async (url) => {
        capturedUrl = String(url);
        return jsonResponse(
          successEnvelope({
            candidate_id: 'candidate-1',
            assignment_id: 'assignment-1',
            qvc_attempts: [
              qvcAttemptResponse({
                status: 'approved',
                outcome_code: 'approved',
                outcome_recorded_at: '2026-09-03T10:00:00Z',
                outcome_recorded_by: { id: 'staff-2', role: 'mps' },
                internal_note: 'Cleared.',
              }),
            ],
            updated_at: '2026-09-03T10:00:00Z',
          })
        );
      });
      const client = buildClient();

      const result = await client.getQvcAttempts('candidate-1');

      expect(capturedUrl).toContain('/admin/candidates/candidate-1/qvc_attempts');
      expect(result.qvcAttempts).toHaveLength(1);
      expect(result.qvcAttempts[0]).toEqual({
        id: 'qvc-attempt-1',
        attemptNumber: 1,
        appointmentDate: '2026-09-01',
        outcomeCode: 'approved',
        noShow: false,
        outcomeRecordedAt: '2026-09-03T10:00:00Z',
        status: 'approved',
        internalNote: 'Cleared.',
        scheduledBy: { id: 'staff-1', role: 'mps' },
        outcomeRecordedBy: { id: 'staff-2', role: 'mps' },
      });
    });

    // Regression test: the backend actually stores/returns `re_medical`
    // (CandidateQvcAttempt::OUTCOME_CODES), not `re_medical_required` --
    // an earlier build recognized only the latter, which would have
    // silently dropped every real re_medical outcome to undefined.
    it('recognizes re_medical (not re_medical_required) as a valid outcome code', async () => {
      stubFetch(async () =>
        jsonResponse(
          successEnvelope({
            candidate_id: 'candidate-1',
            assignment_id: 'assignment-1',
            qvc_attempts: [qvcAttemptResponse({ status: 're_medical', outcome_code: 're_medical' })],
            updated_at: '2026-09-03T10:00:00Z',
          })
        )
      );
      const client = buildClient();

      const result = await client.getQvcAttempts('candidate-1');

      expect(result.qvcAttempts[0].status).toBe('re_medical');
      expect(result.qvcAttempts[0].outcomeCode).toBe('re_medical');
    });

    it('falls back to an empty list for a malformed response', async () => {
      stubFetch(async () => jsonResponse(successEnvelope({ candidate_id: 'candidate-1', assignment_id: null })));
      const client = buildClient();

      const result = await client.getQvcAttempts('candidate-1');

      expect(result.qvcAttempts).toEqual([]);
    });
  });

  describe('scheduleQvcAppointment', () => {
    it('sends the documented request body and Idempotency-Key header', async () => {
      let capturedUrl: string | undefined;
      let capturedBody: string | undefined;
      let capturedHeaders: Record<string, string> | undefined;
      stubFetch(async (url, init) => {
        capturedUrl = String(url);
        capturedBody = init?.body as string;
        capturedHeaders = init?.headers as Record<string, string>;
        return jsonResponse(
          successEnvelope({ workflow: workflowStateResponse(), transition: historyItemResponse() }),
          { status: 201 }
        );
      });
      const client = buildClient();

      const result = await client.scheduleQvcAppointment({
        candidateId: 'candidate-1',
        appointmentDate: '2026-09-05',
        expectedCurrentStageCode: 'documents_shared_with_qatar_bu',
        note: 'First attempt',
        idempotencyKey: 'idem-schedule-1',
      });

      expect(capturedUrl).toContain('/admin/candidates/candidate-1/qvc_attempts');
      expect(capturedHeaders?.['Idempotency-Key']).toBe('idem-schedule-1');
      expect(JSON.parse(capturedBody!)).toEqual({
        candidate_qvc_attempt: {
          appointment_date: '2026-09-05',
          expected_current_stage_code: 'documents_shared_with_qatar_bu',
          note: 'First attempt',
        },
      });
      expect(result.transition).not.toBeNull();
      expect(result.qvcAttempt).toBeNull();
    });

    it('maps a qvc_attempt-shaped response (no stage transition) distinctly from a transition-shaped one', async () => {
      stubFetch(async () =>
        jsonResponse(
          successEnvelope({
            workflow: workflowStateResponse(),
            qvc_attempt: {
              id: 'qvc-attempt-2',
              attempt_number: 2,
              appointment_date: '2026-09-06',
              outcome_code: null,
              no_show: false,
              outcome_recorded_at: null,
              status: 'scheduled',
              internal_note: null,
              scheduled_by: { id: 'staff-1', role: 'mps' },
              outcome_recorded_by: null,
            },
          }),
          { status: 201 }
        )
      );
      const client = buildClient();

      const result = await client.scheduleQvcAppointment({
        candidateId: 'candidate-1',
        appointmentDate: '2026-09-06',
        idempotencyKey: 'idem-schedule-2',
      });

      expect(result.transition).toBeNull();
      expect(result.qvcAttempt?.id).toBe('qvc-attempt-2');
      expect(result.qvcAttempt?.attemptNumber).toBe(2);
    });
  });

  describe('recordQvcOutcome', () => {
    it('sends outcome_code, no_show and the Idempotency-Key header to the attempt-scoped PATCH endpoint', async () => {
      let capturedUrl: string | undefined;
      let capturedMethod: string | undefined;
      let capturedBody: string | undefined;
      let capturedHeaders: Record<string, string> | undefined;
      stubFetch(async (url, init) => {
        capturedUrl = String(url);
        capturedMethod = init?.method;
        capturedBody = init?.body as string;
        capturedHeaders = init?.headers as Record<string, string>;
        return jsonResponse(successEnvelope({ workflow: workflowStateResponse(), transition: historyItemResponse() }));
      });
      const client = buildClient();

      await client.recordQvcOutcome({
        candidateId: 'candidate-1',
        qvcAttemptId: 'qvc-attempt-1',
        outcomeCode: 'approved',
        noShow: false,
        expectedCurrentStageCode: 'qvc_appointment_booked',
        idempotencyKey: 'idem-outcome-1',
      });

      expect(capturedUrl).toContain('/admin/candidates/candidate-1/qvc_attempts/qvc-attempt-1');
      expect(capturedMethod).toBe('PATCH');
      expect(capturedHeaders?.['Idempotency-Key']).toBe('idem-outcome-1');
      expect(JSON.parse(capturedBody!)).toEqual({
        candidate_qvc_attempt: {
          outcome_code: 'approved',
          no_show: false,
          expected_current_stage_code: 'qvc_appointment_booked',
        },
      });
    });

    it('sends no_show true without an outcome_code for a no-show', async () => {
      let capturedBody: string | undefined;
      stubFetch(async (_url, init) => {
        capturedBody = init?.body as string;
        return jsonResponse(successEnvelope({ workflow: workflowStateResponse(), transition: historyItemResponse() }));
      });
      const client = buildClient();

      await client.recordQvcOutcome({
        candidateId: 'candidate-1',
        qvcAttemptId: 'qvc-attempt-1',
        noShow: true,
        idempotencyKey: 'idem-outcome-2',
      });

      expect(JSON.parse(capturedBody!)).toEqual({ candidate_qvc_attempt: { no_show: true } });
    });
  });

  describe('getVisaDecisions', () => {
    function visaDecisionResponse(overrides: Record<string, unknown> = {}) {
      return {
        id: 'visa-decision-1',
        outcome_code: 'issued',
        decision_date: '2026-09-10',
        rejection_reason_code: null,
        visa_copy_attached: true,
        created_at: '2026-09-10T09:00:00Z',
        recorded_by: { id: 'staff-1', role: 'mps' },
        ...overrides,
      };
    }

    it('maps the visa decisions collection', async () => {
      let capturedUrl: string | undefined;
      stubFetch(async (url) => {
        capturedUrl = String(url);
        return jsonResponse(
          successEnvelope({
            candidate_id: 'candidate-1',
            assignment_id: 'assignment-1',
            visa_decisions: [visaDecisionResponse()],
            updated_at: '2026-09-10T09:00:00Z',
          })
        );
      });
      const client = buildClient();

      const result = await client.getVisaDecisions('candidate-1');

      expect(capturedUrl).toContain('/admin/candidates/candidate-1/visa_decisions');
      expect(result.visaDecisions).toEqual([
        {
          id: 'visa-decision-1',
          outcomeCode: 'issued',
          decisionDate: '2026-09-10',
          rejectionReasonCode: null,
          visaCopyAttached: true,
          createdAt: '2026-09-10T09:00:00Z',
          recordedBy: { id: 'staff-1', role: 'mps' },
        },
      ]);
    });

    it('recognizes a structured rejection reason code, and null for an unrecognized one', async () => {
      stubFetch(async () =>
        jsonResponse(
          successEnvelope({
            candidate_id: 'candidate-1',
            assignment_id: 'assignment-1',
            visa_decisions: [
              visaDecisionResponse({ outcome_code: 'rejected', rejection_reason_code: 'medical_issue', visa_copy_attached: false }),
              visaDecisionResponse({ id: 'visa-decision-2', outcome_code: 'rejected', rejection_reason_code: 'not_a_real_code' }),
            ],
            updated_at: '2026-09-10T09:00:00Z',
          })
        )
      );
      const client = buildClient();

      const result = await client.getVisaDecisions('candidate-1');

      expect(result.visaDecisions[0].rejectionReasonCode).toBe('medical_issue');
      expect(result.visaDecisions[1].rejectionReasonCode).toBeNull();
    });

    it('falls back to an empty list for a malformed response', async () => {
      stubFetch(async () => jsonResponse(successEnvelope({ candidate_id: 'candidate-1', assignment_id: null })));
      const client = buildClient();

      const result = await client.getVisaDecisions('candidate-1');

      expect(result.visaDecisions).toEqual([]);
    });
  });

  describe('recordVisaDecision', () => {
    it('sends the FormData body as-is (never re-serialized) with the Idempotency-Key header, and never sets Content-Type', async () => {
      let capturedUrl: string | undefined;
      let capturedBody: unknown;
      let capturedHeaders: Record<string, string> | undefined;
      stubFetch(async (url, init) => {
        capturedUrl = String(url);
        capturedBody = init?.body;
        capturedHeaders = init?.headers as Record<string, string>;
        return jsonResponse(
          successEnvelope({
            workflow: workflowStateResponse(),
            visa_decision: {
              id: 'visa-decision-1',
              outcome_code: 'issued',
              decision_date: '2026-09-10',
              rejection_reason_code: null,
              visa_copy_attached: true,
              created_at: '2026-09-10T09:00:00Z',
              recorded_by: { id: 'staff-1', role: 'mps' },
            },
          }),
          { status: 201 }
        );
      });
      const client = buildClient();
      const formData = new FormData();
      formData.append('candidate_visa_decision[outcome_code]', 'issued');
      formData.append('candidate_visa_decision[decision_date]', '2026-09-10');

      const result = await client.recordVisaDecision({ candidateId: 'candidate-1', formData, idempotencyKey: 'idem-visa-1' });

      expect(capturedUrl).toContain('/admin/candidates/candidate-1/visa_decisions');
      expect(capturedBody).toBe(formData);
      expect(capturedHeaders?.['Idempotency-Key']).toBe('idem-visa-1');
      expect(capturedHeaders?.['Content-Type']).toBeUndefined();
      expect(result.visaDecision.id).toBe('visa-decision-1');
      expect(result.visaDecision.visaCopyAttached).toBe(true);
    });
  });

  describe('getVisaCopyAccess', () => {
    it('POSTs to the visa-copy-access endpoint and maps the short-lived credential', async () => {
      let capturedUrl: string | undefined;
      let capturedMethod: string | undefined;
      stubFetch(async (url, init) => {
        capturedUrl = String(url);
        capturedMethod = init?.method;
        return jsonResponse(
          successEnvelope({
            visa_decision_id: 'visa-decision-1',
            url: '/rails/active_storage/disk/abc/visa-copy.pdf',
            expires_at: '2026-09-10T09:05:00Z',
          })
        );
      });
      const client = buildClient();

      const result = await client.getVisaCopyAccess('candidate-1', 'visa-decision-1');

      expect(capturedUrl).toContain('/admin/candidates/candidate-1/visa_decisions/visa-decision-1/visa_copy_access');
      expect(capturedMethod).toBe('POST');
      expect(result).toEqual({
        visaDecisionId: 'visa-decision-1',
        url: '/rails/active_storage/disk/abc/visa-copy.pdf',
        expiresAt: '2026-09-10T09:05:00Z',
      });
    });
  });

  describe('getFlightDetail', () => {
    function flightDetailResponse(overrides: Record<string, unknown> = {}) {
      return {
        id: 'flight-detail-1',
        airline: 'Qatar Airways',
        flight_number: 'QR-101',
        sector: 'LHE-DOH',
        flight_departure_at: '2026-09-20T14:30:00Z',
        ticket_attached: true,
        mobilized_on: null,
        mobilized: false,
        recorded_by: { id: 'staff-1', role: 'mps' },
        mobilized_recorded_by: null,
        ...overrides,
      };
    }

    it('maps an existing flight detail', async () => {
      let capturedUrl: string | undefined;
      stubFetch(async (url) => {
        capturedUrl = String(url);
        return jsonResponse(
          successEnvelope({
            candidate_id: 'candidate-1',
            assignment_id: 'assignment-1',
            flight_detail: flightDetailResponse(),
            updated_at: '2026-09-20T14:30:00Z',
          })
        );
      });
      const client = buildClient();

      const result = await client.getFlightDetail('candidate-1');

      expect(capturedUrl).toContain('/admin/candidates/candidate-1/flight_detail');
      expect(result.flightDetail).toEqual({
        id: 'flight-detail-1',
        airline: 'Qatar Airways',
        flightNumber: 'QR-101',
        sector: 'LHE-DOH',
        flightDepartureAt: '2026-09-20T14:30:00Z',
        ticketAttached: true,
        mobilizedOn: null,
        mobilized: false,
        recordedBy: { id: 'staff-1', role: 'mps' },
        mobilizedRecordedBy: null,
      });
    });

    it('maps null when no flight detail has been recorded yet', async () => {
      stubFetch(async () =>
        jsonResponse(successEnvelope({ candidate_id: 'candidate-1', assignment_id: 'assignment-1', flight_detail: null, updated_at: null }))
      );
      const client = buildClient();

      const result = await client.getFlightDetail('candidate-1');

      expect(result.flightDetail).toBeNull();
    });
  });

  describe('recordFlightDetail', () => {
    it('sends the FormData body as-is with the Idempotency-Key header', async () => {
      let capturedUrl: string | undefined;
      let capturedBody: unknown;
      let capturedHeaders: Record<string, string> | undefined;
      stubFetch(async (url, init) => {
        capturedUrl = String(url);
        capturedBody = init?.body;
        capturedHeaders = init?.headers as Record<string, string>;
        return jsonResponse(
          successEnvelope({
            workflow: workflowStateResponse(),
            flight_detail: {
              id: 'flight-detail-1',
              airline: 'Qatar Airways',
              flight_number: 'QR-101',
              sector: 'LHE-DOH',
              flight_departure_at: '2026-09-20T14:30:00Z',
              ticket_attached: true,
              mobilized_on: null,
              mobilized: false,
              recorded_by: { id: 'staff-1', role: 'mps' },
              mobilized_recorded_by: null,
            },
          }),
          { status: 201 }
        );
      });
      const client = buildClient();
      const formData = new FormData();
      formData.append('candidate_flight_detail[airline]', 'Qatar Airways');

      const result = await client.recordFlightDetail({ candidateId: 'candidate-1', formData, idempotencyKey: 'idem-flight-1' });

      expect(capturedUrl).toContain('/admin/candidates/candidate-1/flight_detail');
      expect(capturedBody).toBe(formData);
      expect(capturedHeaders?.['Idempotency-Key']).toBe('idem-flight-1');
      expect(result.flightDetail.id).toBe('flight-detail-1');
    });
  });

  describe('mobilizeFlightDetail', () => {
    it('PATCHes the flight-detail endpoint with mobilized_on as JSON and the Idempotency-Key header', async () => {
      let capturedUrl: string | undefined;
      let capturedMethod: string | undefined;
      let capturedBody: string | undefined;
      let capturedHeaders: Record<string, string> | undefined;
      stubFetch(async (url, init) => {
        capturedUrl = String(url);
        capturedMethod = init?.method;
        capturedBody = init?.body as string;
        capturedHeaders = init?.headers as Record<string, string>;
        return jsonResponse(
          successEnvelope({
            workflow: workflowStateResponse({ current_stage: timelineStageResponse({ code: 'mobilized', position: 15 }) }),
            flight_detail: {
              id: 'flight-detail-1',
              airline: 'Qatar Airways',
              flight_number: 'QR-101',
              sector: 'LHE-DOH',
              flight_departure_at: '2026-09-20T14:30:00Z',
              ticket_attached: true,
              mobilized_on: '2026-09-21',
              mobilized: true,
              recorded_by: { id: 'staff-1', role: 'mps' },
              mobilized_recorded_by: { id: 'staff-1', role: 'mps' },
            },
          })
        );
      });
      const client = buildClient();

      const result = await client.mobilizeFlightDetail({
        candidateId: 'candidate-1',
        mobilizedOn: '2026-09-21',
        expectedCurrentStageCode: 'flight_details_uploaded',
        idempotencyKey: 'idem-mobilize-1',
      });

      expect(capturedUrl).toContain('/admin/candidates/candidate-1/flight_detail');
      expect(capturedMethod).toBe('PATCH');
      expect(capturedHeaders?.['Idempotency-Key']).toBe('idem-mobilize-1');
      expect(JSON.parse(capturedBody!)).toEqual({
        candidate_flight_detail: { mobilized_on: '2026-09-21', expected_current_stage_code: 'flight_details_uploaded' },
      });
      expect(result.flightDetail.mobilized).toBe(true);
      expect(result.flightDetail.mobilizedOn).toBe('2026-09-21');
    });
  });

  describe('getFlightTicketAccess', () => {
    it('POSTs to the ticket-access endpoint and maps the short-lived credential', async () => {
      let capturedUrl: string | undefined;
      let capturedMethod: string | undefined;
      stubFetch(async (url, init) => {
        capturedUrl = String(url);
        capturedMethod = init?.method;
        return jsonResponse(
          successEnvelope({
            flight_detail_id: 'flight-detail-1',
            url: '/rails/active_storage/disk/abc/ticket.pdf',
            expires_at: '2026-09-10T09:05:00Z',
          })
        );
      });
      const client = buildClient();

      const result = await client.getFlightTicketAccess('candidate-1');

      expect(capturedUrl).toContain('/admin/candidates/candidate-1/flight_detail/ticket_access');
      expect(capturedMethod).toBe('POST');
      expect(result).toEqual({
        flightDetailId: 'flight-detail-1',
        url: '/rails/active_storage/disk/abc/ticket.pdf',
        expiresAt: '2026-09-10T09:05:00Z',
      });
    });
  });

  describe('error mapping', () => {
    async function rejectionForServerCode(code: string, status: number, extra: Record<string, unknown> = {}) {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code, message: 'server message', ...extra }]), { status }));
      const client = buildClient();
      try {
        await client.getWorkflowState('candidate-1');
        throw new Error('expected rejection');
      } catch (error) {
        return error;
      }
    }

    it.each([
      ['validation_failed', 422, 'VALIDATION_ERROR'],
      ['workflow_transition_stale', 409, 'WORKFLOW_TRANSITION_STALE'],
      ['idempotency_conflict', 409, 'IDEMPOTENCY_CONFLICT'],
      ['missing_idempotency_key', 400, 'MISSING_IDEMPOTENCY_KEY'],
      ['invalid_idempotency_key', 400, 'INVALID_IDEMPOTENCY_KEY'],
      ['idempotency_in_progress', 409, 'IDEMPOTENCY_IN_PROGRESS'],
      ['inactive_account', 403, 'INACTIVE_ACCOUNT'],
    ])('maps server code %s (%i) to %s', async (code, status, expectedCode) => {
      const error = await rejectionForServerCode(code as string, status as number);
      expect(error).toMatchObject({ code: expectedCode, message: 'server message' });
    });

    it('maps workflow_transition_prerequisite_missing with its prerequisite details', async () => {
      const error = await rejectionForServerCode('workflow_transition_prerequisite_missing', 422, {
        details: {
          to_stage_code: 'documents_shared_with_qatar_bu',
          required_fields: [],
          blocking_reasons: ['payment_required'],
        },
      });
      expect(error).toMatchObject({
        code: 'WORKFLOW_TRANSITION_PREREQUISITE_MISSING',
        prerequisite: {
          toStageCode: 'documents_shared_with_qatar_bu',
          requiredFields: [],
          blockingReasons: ['payment_required'],
        },
      });
    });

    it('maps a 401 (surfaced as StaffAuthError SESSION_EXPIRED by authenticatedDataRequest) to SESSION_EXPIRED', async () => {
      const client = buildClient('en', { code: 'SESSION_EXPIRED' });
      await expect(client.getWorkflowState('candidate-1')).rejects.toEqual({ code: 'SESSION_EXPIRED' });
    });

    it('maps a StaffAuthError NETWORK_ERROR through unchanged', async () => {
      const client = buildClient('en', { code: 'NETWORK_ERROR' });
      await expect(client.getWorkflowState('candidate-1')).rejects.toEqual({ code: 'NETWORK_ERROR' });
    });

    it('maps a StaffAuthError OFFLINE through unchanged', async () => {
      const client = buildClient('en', { code: 'OFFLINE' });
      await expect(client.getWorkflowState('candidate-1')).rejects.toEqual({ code: 'OFFLINE' });
    });

    it('maps any other StaffAuthError to UNKNOWN', async () => {
      const client = buildClient('en', { code: 'FORBIDDEN' });
      await expect(client.getWorkflowState('candidate-1')).rejects.toEqual({ code: 'UNKNOWN' });
    });

    it('maps a 403 without a recognized serverCode to FORBIDDEN', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'some_unrecognized_403', message: 'nope' }]), { status: 403 }));
      const client = buildClient();
      await expect(client.getWorkflowState('candidate-1')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('maps a 429 to RATE_LIMITED with retryAfterSeconds', async () => {
      stubFetch(async () =>
        jsonResponse(errorEnvelope([{ code: 'rate_limited', message: 'slow down' }]), {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '15' },
        })
      );
      const client = buildClient();
      await expect(client.getWorkflowState('candidate-1')).rejects.toEqual({ code: 'RATE_LIMITED', retryAfterSeconds: 15 });
    });

    it('maps a 5xx to SERVER_ERROR without inventing an English message', async () => {
      stubFetch(async () => new Response('Internal Server Error', { status: 500 }));
      const client = buildClient();
      await expect(client.getWorkflowState('candidate-1')).rejects.toEqual({ code: 'SERVER_ERROR' });
    });

    it('maps a network failure to NETWORK_ERROR when online', async () => {
      stubFetch(async () => {
        throw new TypeError('Failed to fetch');
      });
      const apiClient = createApiClient({ baseUrl: 'http://example.test', isOnline: () => true });
      const client = createAdminWorkflowClient({ apiClient, staffAuthClient: fakeStaffAuthClient(), getLocale: () => 'en' });
      await expect(client.getWorkflowState('candidate-1')).rejects.toEqual({ code: 'NETWORK_ERROR' });
    });

    it('maps offline to OFFLINE', async () => {
      stubFetch(async () => {
        throw new TypeError('Failed to fetch');
      });
      const apiClient = createApiClient({ baseUrl: 'http://example.test', isOnline: () => false });
      const client = createAdminWorkflowClient({ apiClient, staffAuthClient: fakeStaffAuthClient(), getLocale: () => 'en' });
      await expect(client.getWorkflowState('candidate-1')).rejects.toEqual({ code: 'OFFLINE' });
    });
  });
});

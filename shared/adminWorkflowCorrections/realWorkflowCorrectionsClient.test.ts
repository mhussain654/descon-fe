import { createApiClient } from '../api-client';
import type { StaffAuthClient } from '../auth/staffTypes';
import { createWorkflowCorrectionsClient } from './realWorkflowCorrectionsClient';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' }, ...init });
}

const payload = {
  candidate_id: 'candidate-1',
  assignment_id: 'assignment-1',
  medical_appointment: {
    values: { center_name: 'Al Shifa', center_address: null, appointment_date: '2026-11-25', appointment_time: '10:00' },
    editable: true,
    blocked_reason: null,
    recent_changes: [
      { occurred_at: '2026-11-15T07:00:00Z', reason: 'Moved', changes: { medical_center_name: ['Old', 'Al Shifa'] }, sms_requested: true, actor: { id: 'dev-1', role: 'developer' } },
    ],
  },
  qvc_appointment: { values: { attempt_number: null }, editable: false, blocked_reason: 'not_recorded', recent_changes: [] },
  flight_detail: {
    values: { airline: 'PIA', flight_number: 'PK-283', sector: null, flight_date: '2026-12-10T14:30:00+05:00', has_ticket: true },
    editable: false,
    blocked_reason: 'mobilized',
    recent_changes: [],
  },
  visa_copy: {
    values: { outcome_code: 'issued', decision_date: '2026-11-14', has_visa_copy: true, visa_copy_stored: false },
    editable: true,
    blocked_reason: null,
    recent_changes: [],
  },
};

function fakeStaffAuthClient(): StaffAuthClient {
  return {
    signIn: async () => {
      throw new Error('not used');
    },
    restoreSession: async () => null,
    signOut: async () => undefined,
    authenticatedRequest: async () => {
      throw new Error('not used');
    },
    authenticatedDataRequest: async (makeRequest) => makeRequest('staff-access-token'),
  };
}

function buildClient() {
  const apiClient = createApiClient({ baseUrl: 'http://example.test/api/v1' });
  return createWorkflowCorrectionsClient({ apiClient, staffAuthClient: fakeStaffAuthClient(), getLocale: () => 'en' });
}

describe('createWorkflowCorrectionsClient (real)', () => {
  it('maps the four boxes', async () => {
    let seenUrl = '';
    globalThis.fetch = (async (url: string) => {
      seenUrl = String(url);
      return jsonResponse({ data: payload, meta: {}, errors: [] });
    }) as typeof fetch;

    const result = await buildClient().getCorrections('candidate-1');

    expect(seenUrl).toBe('http://example.test/api/v1/admin/candidates/candidate-1/workflow_corrections');
    expect(result.medicalAppointment).toEqual({
      values: { centerName: 'Al Shifa', centerAddress: null, appointmentDate: '2026-11-25', appointmentTime: '10:00' },
      editable: true,
      blockedReason: null,
      recentChanges: [
        { occurredAt: '2026-11-15T07:00:00Z', reason: 'Moved', changes: { medical_center_name: ['Old', 'Al Shifa'] }, smsRequested: true, actor: { id: 'dev-1', role: 'developer' } },
      ],
    });
    expect(result.qvcAppointment.blockedReason).toBe('not_recorded');
    expect(result.flightDetail.values).toEqual({ airline: 'PIA', flightNumber: 'PK-283', sector: null, flightDate: '2026-12-10T14:30:00+05:00', hasTicket: true });
    expect(result.flightDetail.blockedReason).toBe('mobilized');
    expect(result.visaCopy.values).toEqual({ outcomeCode: 'issued', decisionDate: '2026-11-14', hasVisaCopy: true, visaCopyStored: false });
    expect(result.visaCopy.editable).toBe(true);
  });

  it('maps a rejected visa as blocked', async () => {
    globalThis.fetch = (async () =>
      jsonResponse({
        data: { ...payload, visa_copy: { values: { outcome_code: 'rejected', has_visa_copy: false }, editable: false, blocked_reason: 'visa_rejected', recent_changes: [] } },
        meta: {},
        errors: [],
      })) as typeof fetch;

    const result = await buildClient().getCorrections('candidate-1');

    expect(result.visaCopy.blockedReason).toBe('visa_rejected');
    expect(result.visaCopy.values.visaCopyStored).toBeNull();
  });

  it('sends a new visa copy as multipart with the reason', async () => {
    let body: FormData | undefined;
    let seenUrl = '';
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      seenUrl = String(url);
      body = init.body as FormData;
      return jsonResponse({ data: payload, meta: {}, errors: [] });
    }) as typeof fetch;
    const file = new File(['%PDF-1.4'], 'visa.pdf', { type: 'application/pdf' });

    await buildClient().correctVisaCopy({ candidateId: 'candidate-1', reason: ' Wrong file ', visaCopy: file });

    expect(seenUrl).toBe('http://example.test/api/v1/admin/candidates/candidate-1/workflow_corrections/visa_copy');
    expect(body?.get('workflow_correction[reason]')).toBe('Wrong file');
    expect((body?.get('workflow_correction[visa_copy]') as File).name).toBe('visa.pdf');
    expect(body?.has('workflow_correction[notify_candidate]')).toBe(false);
  });

  it('sends a flight change as multipart, with the ticket only when one is chosen', async () => {
    let body: FormData | undefined;
    let method = '';
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      body = init.body as FormData;
      method = String(init.method);
      return jsonResponse({ data: payload, meta: {}, errors: [] });
    }) as typeof fetch;

    await buildClient().correctFlightDetail({
      candidateId: 'candidate-1', reason: ' New flight ', notifyCandidate: false, airline: 'PIA', flightNumber: 'PK-283',
      sector: '', flightDate: '2026-12-10T14:30', ticket: null,
    });

    expect(method).toBe('PATCH');
    expect(body?.get('workflow_correction[reason]')).toBe('New flight');
    expect(body?.get('workflow_correction[notify_candidate]')).toBe('false');
    expect(body?.get('workflow_correction[flight_date]')).toBe('2026-12-10T14:30');
    expect(body?.has('workflow_correction[ticket]')).toBe(false);
  });

  it('passes on a refusal message as a validation error', async () => {
    globalThis.fetch = (async () =>
      jsonResponse(
        { data: null, meta: {}, errors: [{ code: 'validation_failed', message: 'Give a reason for this change (up to 500 characters).', field: 'workflow_correction.reason' }] },
        { status: 422 }
      )) as typeof fetch;

    await expect(
      buildClient().correctMedicalAppointment({
        candidateId: 'candidate-1', reason: '', notifyCandidate: true, centerName: '', centerAddress: '', appointmentDate: '', appointmentTime: '',
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', field: 'workflow_correction.reason' });
  });
});

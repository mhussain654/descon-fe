import { mobilizationJourney } from './mobilizationJourney';
import type { WorkflowTimelineStage } from './types';

/** A timeline from stage codes, with stages before `currentCode` completed and it current. */
function timeline(codes: string[], currentCode: string | null): WorkflowTimelineStage[] {
  const currentIndex = currentCode === null ? codes.length : codes.indexOf(currentCode);
  return codes.map((code, index) => ({
    code,
    name: code,
    position: index + 1,
    actionType: 'none',
    required: true,
    status: index < currentIndex ? 'completed' : index === currentIndex ? 'current' : 'pending',
    startedAt: index === currentIndex ? '2026-10-01T00:00:00Z' : null,
    completedAt: index < currentIndex ? '2026-09-01T00:00:00Z' : null,
  })) as WorkflowTimelineStage[];
}

const DOCUMENTS = ['registered', 'documents_pending', 'documents_uploaded', 'under_verification', 'verified'];
const QATAR = [
  ...DOCUMENTS, 'campaign_nomination', 'medical_appointment', 'medical_fit', 'fee_pending', 'fee_paid',
  'documents_shared_with_qatar_bu', 'qvc_appointment_booked', 'qvc_completed_outcome_received',
  'visa_issued_or_rejected', 'protection_call', 'appeared_for_protection', 'ticket_handover', 'flight_details_uploaded', 'mobilized',
];
const KSA = [
  ...DOCUMENTS, 'campaign_nomination', 'gamca_medical_pending', 'gamca_medical_completed', 'e_number_processing',
  'e_number_requested', 'e_number_received', 'biometric_completed', 'visa_stamping_case_prepared', 'fee_pending', 'fee_paid',
  'visa_stamping_case_sent', 'visa_issued_or_rejected', 'appeared_for_protection', 'ticket_handover',
];
const COMMON = [
  ...DOCUMENTS, 'campaign_nomination', 'medical_pending', 'medical_completed', 'fee_pending', 'fee_paid',
  'visa_processing', 'visa_issued_or_rejected', 'appeared_for_protection', 'ticket_handover',
];

const statuses = (journey: ReturnType<typeof mobilizationJourney>) =>
  Object.fromEntries(journey.steps.map((step) => [step.code, step.status]));

describe('mobilizationJourney', () => {
  it('lists each Business Unit its own steps in the client order', () => {
    const codes = (countryCode: string, stages: string[]) =>
      mobilizationJourney({ countryCode, timeline: timeline(stages, 'registered') }).steps.map((step) => step.code);

    expect(codes('qatar', QATAR)).toEqual([
      'enrolled', 'document_submission', 'medical', 'mobilization_fee', 'qvc_appointment', 'qvc_status',
      'visa', 'protection', 'pre_flight_brief', 'ready_to_fly',
    ]);
    expect(codes('saudi_arabia', KSA)).toEqual([
      'enrolled', 'document_submission', 'medical', 'mobilization_fee', 'tasheer_registration',
      'visa', 'protection', 'pre_flight_brief', 'ready_to_fly',
    ]);
    expect(codes('uae', COMMON)).toEqual(codes('oman', COMMON));
    expect(codes('uae', COMMON)).toEqual([
      'enrolled', 'document_submission', 'medical', 'mobilization_fee', 'visa', 'protection', 'pre_flight_brief', 'ready_to_fly',
    ]);
  });

  it('shows the document stages as one step: in process until verified, then approved', () => {
    const uploading = mobilizationJourney({ countryCode: 'qatar', timeline: timeline(QATAR, 'under_verification') });
    expect(statuses(uploading)).toMatchObject({ enrolled: 'approved', document_submission: 'in_process', medical: 'upcoming' });
    expect(uploading.current?.code).toBe('document_submission');
    expect(uploading.next?.code).toBe('medical');

    const verified = mobilizationJourney({ countryCode: 'qatar', timeline: timeline(QATAR, 'verified') });
    expect(statuses(verified).document_submission).toBe('approved');
  });

  it('approves a step once its done stage is reached, e.g. the fee once paid', () => {
    const journey = mobilizationJourney({ countryCode: 'qatar', timeline: timeline(QATAR, 'fee_paid') });

    expect(statuses(journey)).toMatchObject({ medical: 'approved', mobilization_fee: 'approved', qvc_appointment: 'upcoming' });
    expect(journey.current?.code).toBe('mobilization_fee');
    expect(journey.next?.code).toBe('qvc_appointment');
    expect(journey).toMatchObject({ approvedCount: 4, totalCount: 10, percentage: 40 });
  });

  it('marks Medical rejected for an unfit result and Visa rejected for a refused visa', () => {
    const unfit = mobilizationJourney({
      countryCode: 'qatar', timeline: timeline(QATAR, 'medical_fit'), outcomes: { medical: 'unfit', visa: null },
    });
    expect(statuses(unfit).medical).toBe('rejected');
    expect(unfit.current?.code).toBe('medical');

    const refused = mobilizationJourney({
      countryCode: 'uae', timeline: timeline(COMMON, 'visa_issued_or_rejected'), outcomes: { medical: 'fit', visa: 'rejected' },
    });
    expect(statuses(refused)).toMatchObject({ medical: 'approved', visa: 'rejected' });
  });

  it('marks Document Submission rejected while a rejected document is waiting to be replaced', () => {
    const journey = mobilizationJourney({
      countryCode: 'qatar', timeline: timeline(QATAR, 'documents_uploaded'), documents: { rejected: 1 },
    });
    expect(statuses(journey).document_submission).toBe('rejected');
  });

  it('shows the fee as next for a KSA candidate in Tasheer registration, as the client lists the fee first', () => {
    const journey = mobilizationJourney({ countryCode: 'saudi_arabia', timeline: timeline(KSA, 'e_number_requested') });

    expect(statuses(journey)).toMatchObject({ medical: 'approved', mobilization_fee: 'upcoming', tasheer_registration: 'in_process' });
    expect(journey.current?.code).toBe('tasheer_registration');
    expect(journey.next?.code).toBe('mobilization_fee');
  });

  it('approves Ready to Fly at the end of a flow that has no stage of its own for it', () => {
    const journey = mobilizationJourney({ countryCode: 'saudi_arabia', timeline: timeline(KSA, 'ticket_handover') });

    expect(statuses(journey)).toMatchObject({ pre_flight_brief: 'approved', ready_to_fly: 'approved' });
    expect(journey.next).toBeNull();
    expect(journey.percentage).toBe(100);
  });

  it('approves a step the process has no stages for once a later step has started', () => {
    const withoutMedical = QATAR.filter((code) => !['medical_appointment', 'medical_fit'].includes(code));
    const journey = mobilizationJourney({ countryCode: 'qatar', timeline: timeline(withoutMedical, 'fee_pending') });

    expect(statuses(journey)).toMatchObject({ medical: 'approved', mobilization_fee: 'in_process' });
  });

  it('has no steps before the candidate has a mobilization process', () => {
    expect(mobilizationJourney({ countryCode: null, timeline: [] })).toMatchObject({ steps: [], current: null, next: null, percentage: 0 });
  });
});

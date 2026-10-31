// The candidate's mobilization journey as the client defined it ("All BU
// Mobilization Flow For MPS-Connect Mobile Application"): a short list of
// steps per Business Unit, each Approved, In process or Rejected. Our internal
// workflow has more, finer stages (documents uploaded, under verification,
// verified ...); each step here groups the stages it covers, so a candidate
// never sees "double" steps for one thing. The backend timeline itself is
// untouched -- this only decides what the candidate-facing screens show.
import type { ApplicationProgressDocuments, WorkflowOutcomes, WorkflowTimelineStage } from './types';

export type JourneyStepCode =
  | 'enrolled'
  | 'document_submission'
  | 'medical'
  | 'mobilization_fee'
  | 'tasheer_registration'
  | 'qvc_appointment'
  | 'qvc_status'
  | 'visa'
  | 'protection'
  | 'pre_flight_brief'
  | 'ready_to_fly';

/** Approved / In process / Rejected (the client's three statuses); `upcoming` is a step not started yet. */
export type JourneyStepStatus = 'approved' | 'in_process' | 'rejected' | 'upcoming';

interface StepDefinition {
  /** The internal workflow stages the step covers. */
  stages: readonly string[];
  /** Reaching any of these stages means the step is done. */
  doneStages: readonly string[];
}

const STEPS: Record<JourneyStepCode, StepDefinition> = {
  enrolled: { stages: ['registered'], doneStages: ['registered'] },
  document_submission: {
    stages: ['documents_pending', 'documents_uploaded', 'under_verification', 'verified', 'campaign_nomination'],
    doneStages: ['verified', 'campaign_nomination'],
  },
  medical: {
    stages: ['medical_pending', 'medical_completed', 'medical_appointment', 'medical_fit', 'gamca_medical_pending', 'gamca_medical_completed'],
    doneStages: ['medical_completed', 'medical_fit', 'gamca_medical_completed'],
  },
  mobilization_fee: { stages: ['fee_pending', 'fee_paid'], doneStages: ['fee_paid'] },
  tasheer_registration: {
    stages: ['e_number_processing', 'e_number_requested', 'e_number_received', 'biometric_completed', 'visa_stamping_case_prepared'],
    doneStages: ['visa_stamping_case_prepared'],
  },
  qvc_appointment: { stages: ['documents_shared_with_qatar_bu', 'qvc_appointment_booked'], doneStages: ['qvc_appointment_booked'] },
  qvc_status: { stages: ['qvc_completed_outcome_received'], doneStages: ['qvc_completed_outcome_received'] },
  visa: { stages: ['visa_processing', 'visa_stamping_case_sent', 'visa_issued_or_rejected'], doneStages: ['visa_issued_or_rejected'] },
  protection: { stages: ['protection_call', 'appeared_for_protection'], doneStages: ['appeared_for_protection'] },
  pre_flight_brief: { stages: ['ticket_handover'], doneStages: ['ticket_handover'] },
  ready_to_fly: { stages: ['flight_details_uploaded', 'mobilized'], doneStages: ['mobilized'] },
};

/** Each Business Unit's steps, in the client's order. UAE and Oman (and any other country) share one flow. */
const FLOWS: Record<'saudi_arabia' | 'qatar' | 'standard', readonly JourneyStepCode[]> = {
  saudi_arabia: [
    'enrolled', 'document_submission', 'medical', 'mobilization_fee', 'tasheer_registration',
    'visa', 'protection', 'pre_flight_brief', 'ready_to_fly',
  ],
  qatar: [
    'enrolled', 'document_submission', 'medical', 'mobilization_fee', 'qvc_appointment', 'qvc_status',
    'visa', 'protection', 'pre_flight_brief', 'ready_to_fly',
  ],
  standard: ['enrolled', 'document_submission', 'medical', 'mobilization_fee', 'visa', 'protection', 'pre_flight_brief', 'ready_to_fly'],
};

export const JOURNEY_STEP_KEYS = {
  enrolled: 'journeyStepEnrolled',
  document_submission: 'journeyStepDocumentSubmission',
  medical: 'journeyStepMedical',
  mobilization_fee: 'journeyStepMobilizationFee',
  tasheer_registration: 'journeyStepTasheerRegistration',
  qvc_appointment: 'journeyStepQvcAppointment',
  qvc_status: 'journeyStepQvcStatus',
  visa: 'journeyStepVisa',
  protection: 'journeyStepProtection',
  pre_flight_brief: 'journeyStepPreFlightBrief',
  ready_to_fly: 'journeyStepReadyToFly',
} as const satisfies Record<JourneyStepCode, string>;

export const JOURNEY_STATUS_KEYS = {
  approved: 'journeyStatusApproved',
  in_process: 'journeyStatusInProcess',
  rejected: 'journeyStatusRejected',
  upcoming: 'journeyStatusUpcoming',
} as const satisfies Record<JourneyStepStatus, string>;

export interface JourneyStep {
  code: JourneyStepCode;
  /** 1..n in the flow's order. */
  position: number;
  status: JourneyStepStatus;
  /** When the step was started (its first stage reached) / done, when known. ISO 8601. */
  startedAt: string | null;
  completedAt: string | null;
}

export interface MobilizationJourney {
  steps: JourneyStep[];
  /** The step the candidate is on now (in process or rejected), or the last approved one once all are done. */
  current: JourneyStep | null;
  /** The first step not started yet after the current one; null when nothing is left. */
  next: JourneyStep | null;
  approvedCount: number;
  totalCount: number;
  /** Whole percent of steps approved. */
  percentage: number;
}

export interface JourneyInput {
  countryCode: string | null | undefined;
  timeline: WorkflowTimelineStage[];
  outcomes?: WorkflowOutcomes | null;
  /** Rejected documents mark Document Submission as rejected until they are replaced. */
  documents?: Pick<ApplicationProgressDocuments, 'rejected'> | null;
}

function flowFor(countryCode: string | null | undefined): readonly JourneyStepCode[] {
  if (countryCode === 'saudi_arabia' || countryCode === 'qatar') return FLOWS[countryCode];
  return FLOWS.standard;
}

const isReached = (stage: WorkflowTimelineStage) => stage.status === 'completed' || stage.status === 'current';

const hasOwnStages = (code: JourneyStepCode, timeline: WorkflowTimelineStage[]) =>
  timeline.some((stage) => STEPS[code].stages.includes(stage.code));

function stepStatus(
  code: JourneyStepCode,
  timeline: WorkflowTimelineStage[],
  input: JourneyInput
): Pick<JourneyStep, 'status' | 'startedAt' | 'completedAt'> {
  const definition = STEPS[code];
  const indexes = timeline
    .map((stage, index) => (definition.stages.includes(stage.code) ? index : -1))
    .filter((index) => index !== -1);
  const covered = indexes.map((index) => timeline[index]);
  const lastIndex = indexes.length > 0 ? Math.max(...indexes) : -1;
  const finalStageReached = timeline.length > 0 && isReached(timeline[timeline.length - 1]);

  const done =
    covered.some((stage) => definition.doneStages.includes(stage.code) && isReached(stage)) ||
    (covered.length > 0 && covered.every((stage) => stage.status === 'completed')) ||
    (lastIndex !== -1 && timeline.slice(lastIndex + 1).some(isReached)) ||
    // A step with no stage of its own in this flow (KSA/UAE/Oman have no "ready to fly" stage) is done at the end of the journey.
    (covered.length === 0 && finalStageReached);
  const started = covered.some(isReached);
  const startedAt = covered.find((stage) => stage.startedAt)?.startedAt ?? null;
  const completedAt = [...covered].reverse().find((stage) => stage.completedAt)?.completedAt ?? null;

  const rejected =
    (code === 'medical' && input.outcomes?.medical === 'unfit') ||
    (code === 'visa' && input.outcomes?.visa === 'rejected') ||
    (code === 'document_submission' && !done && started && (input.documents?.rejected ?? 0) > 0);
  if (rejected) return { status: 'rejected', startedAt, completedAt: null };
  if (done) return { status: 'approved', startedAt, completedAt };
  if (started) return { status: 'in_process', startedAt, completedAt: null };
  return { status: 'upcoming', startedAt: null, completedAt: null };
}

export function mobilizationJourney(input: JourneyInput): MobilizationJourney {
  const timeline = [...input.timeline].sort((a, b) => a.position - b.position);
  const computed: JourneyStep[] = flowFor(input.countryCode).map((code, index) => ({
    code,
    position: index + 1,
    ...stepStatus(code, timeline, input),
  }));
  // A step whose stages this process doesn't have is done once a later step has started.
  const steps = computed.map((step, index) =>
    step.status === 'upcoming' && !hasOwnStages(step.code, timeline) && computed.slice(index + 1).some((later) => later.status !== 'upcoming')
      ? { ...step, status: 'approved' as const }
      : step
  );
  const activeIndex = steps.findIndex((step) => step.status === 'in_process' || step.status === 'rejected');
  const lastApprovedIndex = steps.map((step) => step.status).lastIndexOf('approved');
  const currentIndex = activeIndex !== -1 ? activeIndex : lastApprovedIndex;
  const current = currentIndex === -1 ? null : steps[currentIndex];
  // The first step not started yet. In the KSA flow the client lists the fee
  // before Tasheer registration while the workflow does Tasheer first, so a
  // candidate in Tasheer sees the fee as next, not the visa.
  const next = steps.find((step) => step.status === 'upcoming') ?? null;
  const approvedCount = steps.filter((step) => step.status === 'approved').length;
  const totalCount = steps.length;

  return {
    steps: timeline.length === 0 ? [] : steps,
    current: timeline.length === 0 ? null : current,
    next: timeline.length === 0 ? null : next,
    approvedCount: timeline.length === 0 ? 0 : approvedCount,
    totalCount: timeline.length === 0 ? 0 : totalCount,
    percentage: timeline.length === 0 || totalCount === 0 ? 0 : Math.round((approvedCount / totalCount) * 100),
  };
}

// Real AdminWorkflowClient implementation (MPS-F501 Phase A/B), calling the
// backend documented in descon-be's merged admin workflow contract:
//   GET  /api/v1/admin/candidates/:candidate_id/workflow_state
//   GET  /api/v1/admin/candidates/:candidate_id/workflow_history
//   GET  /api/v1/admin/candidates/:candidate_id/workflow_transitions
//   POST /api/v1/admin/candidates/:candidate_id/workflow_transitions
//   GET  /api/v1/admin/candidates/:candidate_id/qvc_attempts
//   POST /api/v1/admin/candidates/:candidate_id/qvc_attempts
//   PATCH /api/v1/admin/candidates/:candidate_id/qvc_attempts/:id
//
// Authentication goes through StaffAuthClient.authenticatedDataRequest, not
// authenticatedRequest -- these calls' own success/error shape (a 409 stale-
// expectation/idempotency conflict, a 422 missing-prerequisite) must reach
// the caller intact, matching the established adminDocumentReviews
// precedent (see its realAdminDocumentReviewsClient.ts).
import type { ApiClient, ApiError, ApiErrorItem } from '../api-client';
import type { StaffAuthClient, StaffAuthError } from '../auth/staffTypes';
import type {
  AdminQvcAttempt,
  AdminQvcAttempts,
  AdminWorkflowClient,
  AdminWorkflowError,
  AdminWorkflowErrorCode,
  AdminWorkflowState,
  AllowedWorkflowTransition,
  AllowedWorkflowTransitions,
  AdminWorkflowHistory,
  QvcActionResult,
  QvcAttemptStatus,
  QvcOutcomeCode,
  RecordQvcOutcomeInput,
  ScheduleQvcAppointmentInput,
  SubmitWorkflowTransitionInput,
  WorkflowActor,
  WorkflowActorDisplayRole,
  WorkflowHistoryItem,
  WorkflowProtectionRecord,
  WorkflowStageReference,
  WorkflowTimelineStage,
  WorkflowTransitionDetails,
  WorkflowTransitionPrerequisiteDetails,
  WorkflowTransitionResult,
} from './types';

interface TimelineStageResponse {
  code: string;
  name: string;
  position: number;
  status: string;
  started_at?: string | null;
  completed_at?: string | null;
}

interface ProtectionRecordResponse {
  id: string;
  appeared_on: string | null;
  appeared_recorded_at: string | null;
  protected_on: string | null;
  ready_to_fly_at: string | null;
}

interface WorkflowStateResponse {
  candidate_id: string;
  assignment_id: string | null;
  candidate_status: string;
  current_stage: TimelineStageResponse | null;
  timeline: TimelineStageResponse[];
  completed_count: number;
  total_count: number;
  progress_percentage: number;
  protection: ProtectionRecordResponse | null;
  updated_at: string | null;
}

interface AllowedTransitionResponse {
  code: string;
  name: string;
  position: number;
  required_fields: string[];
  allowed: boolean;
  blocking_reasons: string[];
}

interface AllowedTransitionsResponse {
  candidate_id: string;
  updated_at: string | null;
  allowed_next_transitions: AllowedTransitionResponse[];
}

interface StageReferenceResponse {
  code: string;
  name: string;
  position: number;
}

interface ActorResponse {
  id: string;
  role: string;
}

interface TransitionDetailsResponse {
  source?: string;
  appointment_date?: string;
  qvc_outcome_code?: string;
  qvc_outcome_date?: string;
  visa_outcome_code?: string;
  visa_outcome_date?: string;
  appeared_for_protection_on?: string;
  protected_on?: string;
  flight_reference?: string;
  flight_date?: string;
  mobilized_on?: string;
}

interface HistoryItemResponse {
  from_stage: StageReferenceResponse | null;
  to_stage: StageReferenceResponse;
  occurred_at: string;
  reason_code: string | null;
  details: TransitionDetailsResponse | null;
  actor?: ActorResponse | null;
}

interface WorkflowHistoryResponse {
  candidate_id: string;
  assignment_id: string | null;
  history: HistoryItemResponse[];
  updated_at: string | null;
}

interface TransitionResultResponse {
  workflow: WorkflowStateResponse;
  transition: HistoryItemResponse;
}

interface QvcAttemptResponse {
  id: string;
  attempt_number: number;
  appointment_date: string;
  outcome_code: string | null;
  no_show: boolean;
  outcome_recorded_at: string | null;
  status: string;
  internal_note: string | null;
  scheduled_by: ActorResponse | null;
  outcome_recorded_by: ActorResponse | null;
}

interface QvcAttemptsResponse {
  candidate_id: string;
  assignment_id: string | null;
  qvc_attempts: QvcAttemptResponse[];
  updated_at: string | null;
}

/** The backend returns exactly one of `transition` (a stage change happened) or `qvc_attempt` (the attempt/candidate summary changed without a stage change), never both -- see CandidateQvcAttemptsController#serialized_result. */
interface QvcActionResponse {
  workflow: WorkflowStateResponse;
  transition?: HistoryItemResponse;
  qvc_attempt?: QvcAttemptResponse;
}

export interface RealAdminWorkflowClientOptions {
  apiClient: ApiClient;
  staffAuthClient: StaffAuthClient;
  /** Read fresh on every call so a language switch is reflected immediately -- the backend localizes stage names and messages per this header. */
  getLocale: () => 'en' | 'ur';
}

const KNOWN_ACTOR_ROLES = new Set<string>(['admin', 'hr', 'mps', 'finance', 'management']);
const KNOWN_STAGE_STATUSES = new Set<string>(['completed', 'current', 'pending']);
// `re_medical` is what the backend actually stores/returns
// (CandidateQvcAttempt::OUTCOME_CODES) -- `re_medical_required` is accepted
// only as an *input* alias on write, never a value the API returns.
const KNOWN_QVC_OUTCOMES = new Set<string>(['approved', 're_medical', 'rejected']);
const KNOWN_VISA_OUTCOMES = new Set<string>(['issued', 'rejected']);
const KNOWN_QVC_ATTEMPT_STATUSES = new Set<string>(['scheduled', 'approved', 're_medical', 'rejected', 'no_show']);

function toNumber(raw: unknown): number {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
}

function toStringOrUndefined(raw: unknown): string | undefined {
  return typeof raw === 'string' && raw ? raw : undefined;
}

function toActorRole(raw: unknown): WorkflowActorDisplayRole {
  return typeof raw === 'string' && KNOWN_ACTOR_ROLES.has(raw) ? (raw as WorkflowActorDisplayRole) : 'unknown';
}

function toActor(raw: unknown): WorkflowActor | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<ActorResponse>;
  if (typeof value.id !== 'string' || !value.id) return null;
  return { id: value.id, role: toActorRole(value.role) };
}

function toStageStatus(raw: unknown): WorkflowTimelineStage['status'] {
  return typeof raw === 'string' && KNOWN_STAGE_STATUSES.has(raw) ? (raw as WorkflowTimelineStage['status']) : 'pending';
}

function toTimelineStage(raw: unknown): WorkflowTimelineStage {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<TimelineStageResponse>;
  return {
    code: typeof value.code === 'string' ? value.code : '',
    name: typeof value.name === 'string' ? value.name : '',
    position: toNumber(value.position),
    status: toStageStatus(value.status),
    startedAt: toStringOrUndefined(value.started_at),
    completedAt: toStringOrUndefined(value.completed_at),
  };
}

function toTimeline(raw: unknown): WorkflowTimelineStage[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(toTimelineStage);
}

function toProtectionRecord(raw: unknown): WorkflowProtectionRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<ProtectionRecordResponse>;
  if (typeof value.id !== 'string' || !value.id) return null;

  return {
    id: value.id,
    appearedOn: typeof value.appeared_on === 'string' ? value.appeared_on : null,
    appearedRecordedAt: typeof value.appeared_recorded_at === 'string' ? value.appeared_recorded_at : null,
    protectedOn: typeof value.protected_on === 'string' ? value.protected_on : null,
    readyToFlyAt: typeof value.ready_to_fly_at === 'string' ? value.ready_to_fly_at : null,
  };
}

function toWorkflowState(raw: unknown): AdminWorkflowState {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<WorkflowStateResponse>;
  return {
    candidateId: typeof value.candidate_id === 'string' ? value.candidate_id : '',
    assignmentId: typeof value.assignment_id === 'string' ? value.assignment_id : null,
    candidateStatus: typeof value.candidate_status === 'string' ? value.candidate_status : '',
    currentStage: value.current_stage ? toTimelineStage(value.current_stage) : null,
    timeline: toTimeline(value.timeline),
    completedCount: toNumber(value.completed_count),
    totalCount: toNumber(value.total_count),
    progressPercentage: toNumber(value.progress_percentage),
    protection: toProtectionRecord(value.protection),
    updatedAt: typeof value.updated_at === 'string' ? value.updated_at : null,
  };
}

function toAllowedTransition(raw: unknown): AllowedWorkflowTransition {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<AllowedTransitionResponse>;
  return {
    code: typeof value.code === 'string' ? value.code : '',
    name: typeof value.name === 'string' ? value.name : '',
    position: toNumber(value.position),
    requiredFields: Array.isArray(value.required_fields) ? value.required_fields.filter((f): f is string => typeof f === 'string') : [],
    allowed: value.allowed === true,
    blockingReasons: Array.isArray(value.blocking_reasons)
      ? value.blocking_reasons.filter((r): r is string => typeof r === 'string')
      : [],
  };
}

function toAllowedTransitions(raw: unknown): AllowedWorkflowTransitions {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<AllowedTransitionsResponse>;
  return {
    candidateId: typeof value.candidate_id === 'string' ? value.candidate_id : '',
    updatedAt: typeof value.updated_at === 'string' ? value.updated_at : null,
    allowedNextTransitions: Array.isArray(value.allowed_next_transitions)
      ? value.allowed_next_transitions.map(toAllowedTransition)
      : [],
  };
}

function toStageReference(raw: unknown): WorkflowStageReference {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<StageReferenceResponse>;
  return {
    code: typeof value.code === 'string' ? value.code : '',
    name: typeof value.name === 'string' ? value.name : '',
    position: toNumber(value.position),
  };
}

function toTransitionDetails(raw: unknown): WorkflowTransitionDetails | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<TransitionDetailsResponse>;
  return {
    source: toStringOrUndefined(value.source),
    appointmentDate: toStringOrUndefined(value.appointment_date),
    qvcOutcomeCode:
      typeof value.qvc_outcome_code === 'string' && KNOWN_QVC_OUTCOMES.has(value.qvc_outcome_code)
        ? (value.qvc_outcome_code as WorkflowTransitionDetails['qvcOutcomeCode'])
        : undefined,
    qvcOutcomeDate: toStringOrUndefined(value.qvc_outcome_date),
    visaOutcomeCode:
      typeof value.visa_outcome_code === 'string' && KNOWN_VISA_OUTCOMES.has(value.visa_outcome_code)
        ? (value.visa_outcome_code as WorkflowTransitionDetails['visaOutcomeCode'])
        : undefined,
    visaOutcomeDate: toStringOrUndefined(value.visa_outcome_date),
    appearedForProtectionOn: toStringOrUndefined(value.appeared_for_protection_on),
    protectedOn: toStringOrUndefined(value.protected_on),
    flightReference: toStringOrUndefined(value.flight_reference),
    flightDate: toStringOrUndefined(value.flight_date),
    mobilizedOn: toStringOrUndefined(value.mobilized_on),
  };
}

function toHistoryItem(raw: unknown): WorkflowHistoryItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<HistoryItemResponse>;
  if (!value.to_stage) return null;

  return {
    fromStage: value.from_stage ? toStageReference(value.from_stage) : null,
    toStage: toStageReference(value.to_stage),
    occurredAt: typeof value.occurred_at === 'string' ? value.occurred_at : '',
    reasonCode: typeof value.reason_code === 'string' ? value.reason_code : null,
    details: toTransitionDetails(value.details),
    actor: toActor(value.actor),
  };
}

function toHistoryItems(raw: unknown): WorkflowHistoryItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(toHistoryItem).filter((item): item is WorkflowHistoryItem => item !== null);
}

function toWorkflowHistory(raw: unknown): AdminWorkflowHistory {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<WorkflowHistoryResponse>;
  return {
    candidateId: typeof value.candidate_id === 'string' ? value.candidate_id : '',
    assignmentId: typeof value.assignment_id === 'string' ? value.assignment_id : null,
    history: toHistoryItems(value.history),
    updatedAt: typeof value.updated_at === 'string' ? value.updated_at : null,
  };
}

const EMPTY_HISTORY_ITEM: WorkflowHistoryItem = {
  fromStage: null,
  toStage: { code: '', name: '', position: 0 },
  occurredAt: '',
  reasonCode: null,
  details: null,
  actor: null,
};

function toTransitionResult(raw: unknown): WorkflowTransitionResult {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<TransitionResultResponse>;
  return {
    // A malformed/missing workflow or transition in a 2xx response would be
    // a genuine contract violation -- fall back to an empty, clearly-blank
    // value rather than throwing, consistent with this module's
    // never-crash mapping convention elsewhere.
    workflow: toWorkflowState(value.workflow),
    transition: value.transition ? (toHistoryItem(value.transition) ?? EMPTY_HISTORY_ITEM) : EMPTY_HISTORY_ITEM,
  };
}

function toQvcOutcomeCode(raw: unknown): QvcOutcomeCode | null {
  return typeof raw === 'string' && KNOWN_QVC_OUTCOMES.has(raw) ? (raw as QvcOutcomeCode) : null;
}

function toQvcAttemptStatus(raw: unknown): QvcAttemptStatus {
  return typeof raw === 'string' && KNOWN_QVC_ATTEMPT_STATUSES.has(raw) ? (raw as QvcAttemptStatus) : 'scheduled';
}

function toQvcAttempt(raw: unknown): AdminQvcAttempt | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<QvcAttemptResponse>;
  if (typeof value.id !== 'string' || !value.id) return null;

  return {
    id: value.id,
    attemptNumber: toNumber(value.attempt_number),
    appointmentDate: typeof value.appointment_date === 'string' ? value.appointment_date : '',
    outcomeCode: toQvcOutcomeCode(value.outcome_code),
    noShow: value.no_show === true,
    outcomeRecordedAt: typeof value.outcome_recorded_at === 'string' ? value.outcome_recorded_at : null,
    status: toQvcAttemptStatus(value.status),
    internalNote: typeof value.internal_note === 'string' ? value.internal_note : null,
    scheduledBy: toActor(value.scheduled_by),
    outcomeRecordedBy: toActor(value.outcome_recorded_by),
  };
}

function toQvcAttempts(raw: unknown): AdminQvcAttempts {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<QvcAttemptsResponse>;
  const attempts = Array.isArray(value.qvc_attempts) ? value.qvc_attempts : [];
  return {
    candidateId: typeof value.candidate_id === 'string' ? value.candidate_id : '',
    assignmentId: typeof value.assignment_id === 'string' ? value.assignment_id : null,
    qvcAttempts: attempts.map(toQvcAttempt).filter((attempt): attempt is AdminQvcAttempt => attempt !== null),
    updatedAt: typeof value.updated_at === 'string' ? value.updated_at : null,
  };
}

function toQvcActionResult(raw: unknown): QvcActionResult {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<QvcActionResponse>;
  return {
    workflow: toWorkflowState(value.workflow),
    transition: value.transition ? toHistoryItem(value.transition) : null,
    qvcAttempt: value.qvc_attempt ? toQvcAttempt(value.qvc_attempt) : null,
  };
}

/** Maps the backend's ErrorItem.code (see openapi.yaml's workflow_transitions POST 409/422 examples) to the shared error taxonomy. */
const SERVER_CODE_TO_ERROR: Record<string, AdminWorkflowErrorCode> = {
  validation_failed: 'VALIDATION_ERROR',
  workflow_transition_stale: 'WORKFLOW_TRANSITION_STALE',
  workflow_transition_prerequisite_missing: 'WORKFLOW_TRANSITION_PREREQUISITE_MISSING',
  idempotency_conflict: 'IDEMPOTENCY_CONFLICT',
  missing_idempotency_key: 'MISSING_IDEMPOTENCY_KEY',
  invalid_idempotency_key: 'INVALID_IDEMPOTENCY_KEY',
  idempotency_in_progress: 'IDEMPOTENCY_IN_PROGRESS',
  inactive_account: 'INACTIVE_ACCOUNT',
};

/** The first error item's own `details` (not `ApiError.details`, which holds the whole raw envelope) -- see openapi.yaml's `paymentRequired`/`expiredPcc` 422 examples. `ApiErrorItem` doesn't type `details` since it's specific to this one error code, so it's read defensively here, mirroring shared/applicationProgress/realApplicationProgressClient.ts's identical pattern. */
function prerequisiteFromFirstError(apiError: ApiError): WorkflowTransitionPrerequisiteDetails | undefined {
  const first = apiError.errors?.[0] as (ApiErrorItem & { details?: Record<string, unknown> }) | undefined;
  const details = first?.details;
  if (!details || typeof details !== 'object') return undefined;

  const requiredFields = Array.isArray(details.required_fields)
    ? details.required_fields.filter((f): f is string => typeof f === 'string')
    : [];
  const blockingReasons = Array.isArray(details.blocking_reasons)
    ? details.blocking_reasons.filter((r): r is string => typeof r === 'string')
    : [];

  return {
    toStageCode: typeof details.to_stage_code === 'string' ? details.to_stage_code : undefined,
    requiredFields,
    blockingReasons,
  };
}

/** A StaffAuthError (from authenticatedDataRequest's own 401 refresh-and-retry path) has no `status`; anything else here is the raw ApiError authenticatedDataRequest rethrew unchanged. */
function isStaffAuthError(error: unknown): error is StaffAuthError {
  return !!error && typeof error === 'object' && 'code' in error && !('status' in error);
}

function toWorkflowError(error: unknown): AdminWorkflowError {
  if (isStaffAuthError(error)) {
    if (error.code === 'SESSION_EXPIRED') return { code: 'SESSION_EXPIRED' };
    if (error.code === 'NETWORK_ERROR') return { code: 'NETWORK_ERROR' };
    if (error.code === 'OFFLINE') return { code: 'OFFLINE' };
    return { code: 'UNKNOWN' };
  }

  const apiError = error as ApiError;
  if (!apiError || typeof apiError !== 'object' || !('code' in apiError)) {
    return { code: 'UNKNOWN' };
  }

  if (apiError.code === 'OFFLINE') return { code: 'OFFLINE' };
  if (apiError.code === 'NETWORK_ERROR' || apiError.code === 'TIMEOUT') return { code: 'NETWORK_ERROR' };
  if (apiError.code === 'CANCELLED') return { code: 'UNKNOWN' };

  const mapped = apiError.serverCode ? SERVER_CODE_TO_ERROR[apiError.serverCode] : undefined;
  if (mapped === 'WORKFLOW_TRANSITION_PREREQUISITE_MISSING') {
    return { code: mapped, message: apiError.message, field: apiError.field, prerequisite: prerequisiteFromFirstError(apiError) };
  }
  if (mapped) {
    return { code: mapped, message: apiError.message, field: apiError.field };
  }

  // A 403 needs its serverCode to distinguish an inactive account from a
  // permission failure -- already handled above via serverCode, so
  // reaching here with a 403 means an unrecognized reason (still FORBIDDEN,
  // never rendered as anything more specific than that).
  if (apiError.status === 403) return { code: 'FORBIDDEN', message: apiError.message };
  if (apiError.status === 409) return { code: 'IDEMPOTENCY_CONFLICT', message: apiError.message };
  if (apiError.status === 422) return { code: 'VALIDATION_ERROR', message: apiError.message, field: apiError.field };
  if (apiError.status === 429) return { code: 'RATE_LIMITED', retryAfterSeconds: apiError.retryAfterSeconds };
  if (apiError.status >= 500) return { code: 'SERVER_ERROR' };

  return { code: 'UNKNOWN', message: apiError.message };
}

export function createAdminWorkflowClient(options: RealAdminWorkflowClientOptions): AdminWorkflowClient {
  const { apiClient, staffAuthClient, getLocale } = options;

  return {
    async getWorkflowState(candidateId: string): Promise<AdminWorkflowState> {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.get<WorkflowStateResponse>(`/admin/candidates/${encodeURIComponent(candidateId)}/workflow_state`, {
            headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() },
          })
        );
        return toWorkflowState(data);
      } catch (error) {
        throw toWorkflowError(error);
      }
    },

    async getAllowedTransitions(candidateId: string): Promise<AllowedWorkflowTransitions> {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.get<AllowedTransitionsResponse>(
            `/admin/candidates/${encodeURIComponent(candidateId)}/workflow_transitions`,
            { headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() } }
          )
        );
        return toAllowedTransitions(data);
      } catch (error) {
        throw toWorkflowError(error);
      }
    },

    async getWorkflowHistory(candidateId: string): Promise<AdminWorkflowHistory> {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.get<WorkflowHistoryResponse>(`/admin/candidates/${encodeURIComponent(candidateId)}/workflow_history`, {
            headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() },
          })
        );
        return toWorkflowHistory(data);
      } catch (error) {
        throw toWorkflowError(error);
      }
    },

    async submitTransition(input: SubmitWorkflowTransitionInput): Promise<WorkflowTransitionResult> {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.post<TransitionResultResponse>(
            `/admin/candidates/${encodeURIComponent(input.candidateId)}/workflow_transitions`,
            {
              candidate_workflow_transition: {
                to_stage_code: input.toStageCode,
                ...(input.expectedCurrentStageCode ? { expected_current_stage_code: input.expectedCurrentStageCode } : {}),
                ...(input.reasonCode ? { reason_code: input.reasonCode } : {}),
                ...(input.note ? { note: input.note } : {}),
                ...(input.evidence && Object.keys(input.evidence).length > 0 ? { evidence: input.evidence } : {}),
              },
            },
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'X-Locale': getLocale(),
                'Idempotency-Key': input.idempotencyKey,
              },
            }
          )
        );
        return toTransitionResult(data);
      } catch (error) {
        throw toWorkflowError(error);
      }
    },

    async getQvcAttempts(candidateId: string): Promise<AdminQvcAttempts> {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.get<QvcAttemptsResponse>(`/admin/candidates/${encodeURIComponent(candidateId)}/qvc_attempts`, {
            headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() },
          })
        );
        return toQvcAttempts(data);
      } catch (error) {
        throw toWorkflowError(error);
      }
    },

    async scheduleQvcAppointment(input: ScheduleQvcAppointmentInput): Promise<QvcActionResult> {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.post<QvcActionResponse>(
            `/admin/candidates/${encodeURIComponent(input.candidateId)}/qvc_attempts`,
            {
              candidate_qvc_attempt: {
                appointment_date: input.appointmentDate,
                ...(input.expectedCurrentStageCode ? { expected_current_stage_code: input.expectedCurrentStageCode } : {}),
                ...(input.note ? { note: input.note } : {}),
              },
            },
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'X-Locale': getLocale(),
                'Idempotency-Key': input.idempotencyKey,
              },
            }
          )
        );
        return toQvcActionResult(data);
      } catch (error) {
        throw toWorkflowError(error);
      }
    },

    async recordQvcOutcome(input: RecordQvcOutcomeInput): Promise<QvcActionResult> {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.patch<QvcActionResponse>(
            `/admin/candidates/${encodeURIComponent(input.candidateId)}/qvc_attempts/${encodeURIComponent(input.qvcAttemptId)}`,
            {
              candidate_qvc_attempt: {
                ...(input.outcomeCode ? { outcome_code: input.outcomeCode } : {}),
                ...(input.noShow !== undefined ? { no_show: input.noShow } : {}),
                ...(input.expectedCurrentStageCode ? { expected_current_stage_code: input.expectedCurrentStageCode } : {}),
                ...(input.note ? { note: input.note } : {}),
              },
            },
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'X-Locale': getLocale(),
                'Idempotency-Key': input.idempotencyKey,
              },
            }
          )
        );
        return toQvcActionResult(data);
      } catch (error) {
        throw toWorkflowError(error);
      }
    },
  };
}

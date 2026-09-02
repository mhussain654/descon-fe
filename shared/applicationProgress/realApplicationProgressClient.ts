// Real ApplicationProgressClient implementation, calling the backend
// documented in descon-be's openapi.yaml:
//   GET  /api/v1/candidate/application_progress
//   POST /api/v1/candidate/document_submissions
import type { ApiClient, ApiError } from '../api-client';
import { toPaymentEligibility, type EligibilityResponse } from '../payments/mapEligibilityResponse';
import type {
  ApplicationProgress,
  ApplicationProgressClient,
  ApplicationProgressDocuments,
  ApplicationProgressError,
  ApplicationProgressErrorCode,
  ApplicationProgressWorkflow,
  ApplicationSubmissionDisplayState,
  BlockingRequirement,
  BlockingRequirementDisplayReason,
  DocumentSubmissionResult,
  SubmitDocumentsParams,
  WorkflowStage,
  WorkflowTimelineStage,
  WorkflowTimelineStageStatus,
} from './types';

interface WorkflowStageResponse {
  code: string;
  name: string;
}

interface WorkflowTimelineStageResponse {
  code: string;
  name: string;
  position: number;
  status: string;
  started_at: string | null;
  completed_at: string | null;
}

interface ApplicationProgressWorkflowResponse {
  timeline: WorkflowTimelineStageResponse[];
  completed_count: number;
  total_count: number;
  progress_percentage: number;
  updated_at: string | null;
}

interface BlockingRequirementResponse {
  requirement_code: string;
  name: string;
  reason: string;
}

interface ApplicationProgressDocumentsResponse {
  required_total: number;
  missing: number;
  uploaded: number;
  pending_review: number;
  verified: number;
  rejected: number;
  submitted_total: number;
  completion_percentage: number;
  can_submit: boolean;
  submission_state: string;
  blocking_requirements: BlockingRequirementResponse[];
}

interface ApplicationProgressResponse {
  candidate_status: string;
  current_workflow_stage: WorkflowStageResponse | null;
  workflow: ApplicationProgressWorkflowResponse;
  documents: ApplicationProgressDocumentsResponse;
  payment: EligibilityResponse;
}

interface DocumentSubmissionResultResponse {
  message: string;
  submission_id: string;
  submitted_at: string;
  submission_state: string;
  documents: {
    required_total: number;
    pending_review: number;
    can_submit: boolean;
  };
}

export interface RealApplicationProgressClientOptions {
  apiClient: ApiClient;
  /** Read fresh on every call so a language switch is reflected immediately -- the backend localizes `name`/`message` per this header. */
  getLocale: () => 'en' | 'ur';
}

const KNOWN_SUBMISSION_STATES = new Set<string>([
  'no_assignment',
  'no_requirements',
  'incomplete',
  'ready',
  'submitted',
  'partially_verified',
  'verified',
  'changes_required',
]);
const KNOWN_BLOCKING_REASONS = new Set<string>(['missing', 'rejected']);

function toSubmissionState(raw: unknown): ApplicationSubmissionDisplayState {
  return typeof raw === 'string' && KNOWN_SUBMISSION_STATES.has(raw) ? (raw as ApplicationSubmissionDisplayState) : 'unknown';
}

function toBlockingReason(raw: unknown): BlockingRequirementDisplayReason {
  return typeof raw === 'string' && KNOWN_BLOCKING_REASONS.has(raw) ? (raw as BlockingRequirementDisplayReason) : 'unknown';
}

function toBlockingRequirement(raw: unknown): BlockingRequirement | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<BlockingRequirementResponse>;
  if (typeof value.requirement_code !== 'string' || !value.requirement_code) return null;

  return {
    requirementCode: value.requirement_code,
    name: typeof value.name === 'string' && value.name ? value.name : value.requirement_code,
    reason: toBlockingReason(value.reason),
  };
}

function toBlockingRequirements(raw: unknown): BlockingRequirement[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(toBlockingRequirement).filter((item): item is BlockingRequirement => item !== null);
}

function toNumber(raw: unknown): number {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
}

function toWorkflowStage(raw: unknown): WorkflowStage | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<WorkflowStageResponse>;
  if (typeof value.code !== 'string' || !value.code) return null;

  return {
    code: value.code,
    name: typeof value.name === 'string' && value.name ? value.name : value.code,
  };
}

const KNOWN_TIMELINE_STAGE_STATUSES = new Set<string>(['completed', 'current', 'pending']);

/** An unrecognized future status safely falls back to `'pending'` -- never crashes, never shows a raw code, and never mis-renders an unknown status as reached. */
function toWorkflowTimelineStageStatus(raw: unknown): WorkflowTimelineStageStatus {
  return typeof raw === 'string' && KNOWN_TIMELINE_STAGE_STATUSES.has(raw) ? (raw as WorkflowTimelineStageStatus) : 'pending';
}

function toIsoStringOrNull(raw: unknown): string | null {
  return typeof raw === 'string' && raw ? raw : null;
}

function toWorkflowTimelineStage(raw: unknown): WorkflowTimelineStage | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<WorkflowTimelineStageResponse>;
  if (typeof value.code !== 'string' || !value.code) return null;

  return {
    code: value.code,
    name: typeof value.name === 'string' && value.name ? value.name : value.code,
    position: toNumber(value.position),
    status: toWorkflowTimelineStageStatus(value.status),
    startedAt: toIsoStringOrNull(value.started_at),
    completedAt: toIsoStringOrNull(value.completed_at),
  };
}

function toWorkflowTimeline(raw: unknown): WorkflowTimelineStage[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(toWorkflowTimelineStage).filter((stage): stage is WorkflowTimelineStage => stage !== null);
}

/** Defensively maps the real, backend-authoritative 15-stage workflow snapshot (MPS-501) -- a malformed field falls back to a safe default (an empty timeline, zero counts) rather than throwing or fabricating stages. */
function toApplicationProgressWorkflow(raw: unknown): ApplicationProgressWorkflow {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<ApplicationProgressWorkflowResponse>;

  return {
    timeline: toWorkflowTimeline(value.timeline),
    completedCount: toNumber(value.completed_count),
    totalCount: toNumber(value.total_count),
    progressPercentage: toNumber(value.progress_percentage),
    updatedAt: toIsoStringOrNull(value.updated_at),
  };
}

/** Defensively maps the documents summary -- a malformed field falls back to a safe default rather than throwing (ticket-wide pattern: never crash on an unexpected backend shape). */
function toDocuments(raw: unknown): ApplicationProgressDocuments {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<ApplicationProgressDocumentsResponse>;

  return {
    requiredTotal: toNumber(value.required_total),
    missing: toNumber(value.missing),
    uploaded: toNumber(value.uploaded),
    pendingReview: toNumber(value.pending_review),
    verified: toNumber(value.verified),
    rejected: toNumber(value.rejected),
    submittedTotal: toNumber(value.submitted_total),
    completionPercentage: toNumber(value.completion_percentage),
    canSubmit: value.can_submit === true,
    submissionState: toSubmissionState(value.submission_state),
    blockingRequirements: toBlockingRequirements(value.blocking_requirements),
  };
}

function toApplicationProgress(raw: unknown): ApplicationProgress {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<ApplicationProgressResponse>;

  return {
    candidateStatus: typeof value.candidate_status === 'string' ? value.candidate_status : '',
    currentWorkflowStage: toWorkflowStage(value.current_workflow_stage),
    workflow: toApplicationProgressWorkflow(value.workflow),
    documents: toDocuments(value.documents),
    payment: toPaymentEligibility(value.payment),
  };
}

function toDocumentSubmissionResult(raw: unknown): DocumentSubmissionResult {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<DocumentSubmissionResultResponse>;
  const documents = (value.documents ?? {}) as Partial<DocumentSubmissionResultResponse['documents']>;

  return {
    message: typeof value.message === 'string' ? value.message : '',
    submissionId: typeof value.submission_id === 'string' ? value.submission_id : '',
    submittedAt: typeof value.submitted_at === 'string' ? value.submitted_at : '',
    submissionState: toSubmissionState(value.submission_state),
    documents: {
      requiredTotal: toNumber(documents.required_total),
      pendingReview: toNumber(documents.pending_review),
      canSubmit: documents.can_submit === true,
    },
  };
}

/** Maps the backend's ErrorItem.code (see openapi.yaml's /candidate/application_progress and /candidate/document_submissions examples) to the shared error taxonomy. */
const SERVER_CODE_TO_ERROR: Record<string, ApplicationProgressErrorCode> = {
  inactive_account: 'INACTIVE_ACCOUNT',
  no_current_assignment: 'NO_CURRENT_ASSIGNMENT',
  no_document_requirements: 'NO_DOCUMENT_REQUIREMENTS',
  documents_incomplete: 'DOCUMENTS_INCOMPLETE',
  documents_rejected: 'DOCUMENTS_REJECTED',
  submission_not_allowed: 'SUBMISSION_NOT_ALLOWED',
  already_submitted: 'ALREADY_SUBMITTED',
  idempotency_conflict: 'CONFLICT',
  idempotency_in_progress: 'IN_PROGRESS',
};

/** The first error item's own `details.blocking_requirements` (not `ApiError.details`, which holds the whole raw envelope) -- see openapi.yaml's `documentsIncomplete`/`documentsRejected` 422 examples. `ApiErrorItem` doesn't type `details` since it's specific to these two codes, so it's read defensively here. */
function blockingRequirementsFromFirstError(apiError: ApiError): BlockingRequirement[] | undefined {
  const first = apiError.errors?.[0] as { details?: { blocking_requirements?: unknown } } | undefined;
  const blockingRequirements = first?.details?.blocking_requirements;
  if (!Array.isArray(blockingRequirements)) return undefined;
  return toBlockingRequirements(blockingRequirements);
}

function toApplicationProgressError(error: unknown): ApplicationProgressError {
  const apiError = error as ApiError;
  if (!apiError || typeof apiError !== 'object' || !('code' in apiError)) {
    return { code: 'UNKNOWN' };
  }

  if (apiError.code === 'OFFLINE') return { code: 'OFFLINE' };
  if (apiError.code === 'NETWORK_ERROR' || apiError.code === 'TIMEOUT') return { code: 'NETWORK_ERROR' };
  if (apiError.code === 'CANCELLED') return { code: 'UNKNOWN' };

  if (apiError.status === 401) return { code: 'SESSION_EXPIRED' };

  const mapped = apiError.serverCode ? SERVER_CODE_TO_ERROR[apiError.serverCode] : undefined;
  if (mapped) {
    return { code: mapped, message: apiError.message, blockingRequirements: blockingRequirementsFromFirstError(apiError) };
  }

  if (apiError.status === 403) return { code: 'INACTIVE_ACCOUNT' };
  if (apiError.status === 409) return { code: 'CONFLICT', message: apiError.message };
  if (apiError.status === 429) return { code: 'RATE_LIMITED', retryAfterSeconds: apiError.retryAfterSeconds };
  if (apiError.status >= 500) return { code: 'SERVER_ERROR' };

  return { code: 'UNKNOWN', message: apiError.message };
}

export function createApplicationProgressClient(options: RealApplicationProgressClientOptions): ApplicationProgressClient {
  const { apiClient, getLocale } = options;

  return {
    async getProgress(accessToken: string): Promise<ApplicationProgress> {
      try {
        const data = await apiClient.get<ApplicationProgressResponse>('/candidate/application_progress', {
          headers: { Authorization: `Bearer ${accessToken}`, 'X-Locale': getLocale() },
        });
        return toApplicationProgress(data);
      } catch (error) {
        throw toApplicationProgressError(error);
      }
    },

    async submitDocuments(params: SubmitDocumentsParams): Promise<DocumentSubmissionResult> {
      const { accessToken, idempotencyKey } = params;
      try {
        // The request body is always empty -- never send a candidate id,
        // assignment id, document id, or requirement code (ticket: "The
        // request body is empty.").
        const data = await apiClient.post<DocumentSubmissionResultResponse>('/candidate/document_submissions', undefined, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Locale': getLocale(),
            'Idempotency-Key': idempotencyKey,
          },
        });
        return toDocumentSubmissionResult(data);
      } catch (error) {
        throw toApplicationProgressError(error);
      }
    },
  };
}

// Real CandidateWorkflowHistoryClient implementation, calling the backend
// documented in descon-be's openapi.yaml:
//   GET /api/v1/candidate/workflow_history
import type { ApiClient, ApiError } from '../api-client';
import type {
  CandidateWorkflowHistoryClient,
  QvcOutcomeCode,
  VisaOutcomeCode,
  WorkflowHistory,
  WorkflowHistoryError,
  WorkflowHistoryErrorCode,
  WorkflowHistoryItem,
  WorkflowHistoryStageReference,
  WorkflowTransitionDetails,
} from './types';

interface WorkflowHistoryStageReferenceResponse {
  code: string;
  name: string;
  position: number;
}

interface WorkflowTransitionDetailsResponse {
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

interface WorkflowHistoryItemResponse {
  from_stage: WorkflowHistoryStageReferenceResponse | null;
  to_stage: WorkflowHistoryStageReferenceResponse;
  occurred_at: string;
  reason_code: string | null;
  details: WorkflowTransitionDetailsResponse | null;
}

interface WorkflowHistoryResponse {
  candidate_id: string;
  assignment_id: string | null;
  history: WorkflowHistoryItemResponse[];
  updated_at: string | null;
}

export interface RealCandidateWorkflowClientOptions {
  apiClient: ApiClient;
  /** Read fresh on every call so a language switch is reflected immediately, same convention as the other real*Client.ts modules. */
  getLocale: () => 'en' | 'ur';
}

const KNOWN_QVC_OUTCOME_CODES = new Set<string>(['approved', 're_medical_required', 'rejected']);
const KNOWN_VISA_OUTCOME_CODES = new Set<string>(['issued', 'rejected']);

function toStageReference(raw: unknown): WorkflowHistoryStageReference | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<WorkflowHistoryStageReferenceResponse>;
  if (typeof value.code !== 'string' || !value.code) return null;

  return {
    code: value.code,
    name: typeof value.name === 'string' && value.name ? value.name : value.code,
    position: typeof value.position === 'number' && Number.isFinite(value.position) ? value.position : 0,
  };
}

function toQvcOutcomeCode(raw: unknown): QvcOutcomeCode | undefined {
  return typeof raw === 'string' && KNOWN_QVC_OUTCOME_CODES.has(raw) ? (raw as QvcOutcomeCode) : undefined;
}

function toVisaOutcomeCode(raw: unknown): VisaOutcomeCode | undefined {
  return typeof raw === 'string' && KNOWN_VISA_OUTCOME_CODES.has(raw) ? (raw as VisaOutcomeCode) : undefined;
}

function toOptionalString(raw: unknown): string | undefined {
  return typeof raw === 'string' && raw ? raw : undefined;
}

/** Every field is independently optional -- absent fields are simply omitted, never fabricated as empty strings. */
function toDetails(raw: unknown): WorkflowTransitionDetails | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<WorkflowTransitionDetailsResponse>;

  const details: WorkflowTransitionDetails = {
    appointmentDate: toOptionalString(value.appointment_date),
    qvcOutcomeCode: toQvcOutcomeCode(value.qvc_outcome_code),
    qvcOutcomeDate: toOptionalString(value.qvc_outcome_date),
    visaOutcomeCode: toVisaOutcomeCode(value.visa_outcome_code),
    visaOutcomeDate: toOptionalString(value.visa_outcome_date),
    appearedForProtectionOn: toOptionalString(value.appeared_for_protection_on),
    protectedOn: toOptionalString(value.protected_on),
    flightReference: toOptionalString(value.flight_reference),
    flightDate: toOptionalString(value.flight_date),
    mobilizedOn: toOptionalString(value.mobilized_on),
  };
  const hasAnyField = Object.values(details).some((fieldValue) => fieldValue !== undefined);
  return hasAnyField ? details : null;
}

function toHistoryItem(raw: unknown): WorkflowHistoryItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<WorkflowHistoryItemResponse>;
  const toStage = toStageReference(value.to_stage);
  if (!toStage || typeof value.occurred_at !== 'string' || !value.occurred_at) return null;

  return {
    fromStage: toStageReference(value.from_stage),
    toStage,
    occurredAt: value.occurred_at,
    reasonCode: typeof value.reason_code === 'string' && value.reason_code ? value.reason_code : null,
    details: toDetails(value.details),
  };
}

function toWorkflowHistory(raw: unknown): WorkflowHistory {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<WorkflowHistoryResponse>;
  const items = Array.isArray(value.history)
    ? value.history.map(toHistoryItem).filter((item): item is WorkflowHistoryItem => item !== null)
    : [];

  return {
    items,
    updatedAt: typeof value.updated_at === 'string' && value.updated_at ? value.updated_at : null,
  };
}

/** Maps the backend's ErrorItem.code (see openapi.yaml's /candidate/workflow_history 403 example) to the shared error taxonomy. */
const SERVER_CODE_TO_ERROR: Record<string, WorkflowHistoryErrorCode> = {
  inactive_account: 'INACTIVE_ACCOUNT',
};

function toWorkflowHistoryError(error: unknown): WorkflowHistoryError {
  const apiError = error as ApiError;
  if (!apiError || typeof apiError !== 'object' || !('code' in apiError)) {
    return { code: 'UNKNOWN' };
  }

  if (apiError.code === 'OFFLINE') return { code: 'OFFLINE' };
  if (apiError.code === 'NETWORK_ERROR' || apiError.code === 'TIMEOUT') return { code: 'NETWORK_ERROR' };
  if (apiError.code === 'CANCELLED') return { code: 'UNKNOWN' };

  if (apiError.status === 401) return { code: 'SESSION_EXPIRED' };
  if (apiError.status === 403) {
    const mapped = apiError.serverCode ? SERVER_CODE_TO_ERROR[apiError.serverCode] : undefined;
    return { code: mapped ?? 'FORBIDDEN' };
  }
  if (apiError.status === 429) {
    return { code: 'RATE_LIMITED', retryAfterSeconds: apiError.retryAfterSeconds };
  }
  if (apiError.status >= 500) return { code: 'SERVER_ERROR' };

  return { code: 'UNKNOWN' };
}

export function createCandidateWorkflowHistoryClient(options: RealCandidateWorkflowClientOptions): CandidateWorkflowHistoryClient {
  const { apiClient, getLocale } = options;

  return {
    async getWorkflowHistory(accessToken: string): Promise<WorkflowHistory> {
      try {
        const data = await apiClient.get<WorkflowHistoryResponse>('/candidate/workflow_history', {
          headers: { Authorization: `Bearer ${accessToken}`, 'X-Locale': getLocale() },
        });
        return toWorkflowHistory(data);
      } catch (error) {
        throw toWorkflowHistoryError(error);
      }
    },
  };
}

// Real AdminWorkflowStageCallScriptsClient implementation (MPS-F706),
// calling the backend documented in descon-be's openapi.yaml:
//   GET   /api/v1/admin/workflow_stage_call_scripts
//   PATCH /api/v1/admin/workflow_stage_call_scripts/{workflow_stage_code}
//
// Authentication goes through StaffAuthClient.authenticatedDataRequest, not
// authenticatedRequest -- the PATCH's own 404/422 shapes must reach the
// caller intact, mirroring realAdminCandidateAiCallsClient.ts's identical
// rationale. No Idempotency-Key header: unlike triggering a call, editing
// content is a plain authorized update with no external side effect to
// dedupe (see the backend controller's own #update action).
import type { ApiClient, ApiError } from '../api-client';
import type { StaffAuthClient, StaffAuthError } from '../auth/staffTypes';
import type { CanonicalWorkflowStageCode } from '../adminWorkflow/canonicalStages';
import type {
  AdminWorkflowStageCallScriptsClient,
  WorkflowStageCallScript,
  WorkflowStageCallScriptActorRef,
  WorkflowStageCallScriptError,
  WorkflowStageCallScriptErrorCode,
  WorkflowStageCallScriptUpdateInput,
} from './types';

interface WorkflowStageCallScriptActorResponse {
  id: string;
  role: string;
}

interface WorkflowStageCallScriptResponse {
  workflow_stage_code: string;
  announcement_en: string;
  announcement_ur: string | null;
  active: boolean;
  updated_by: WorkflowStageCallScriptActorResponse | null;
  updated_at: string;
}

export interface RealAdminWorkflowStageCallScriptsClientOptions {
  apiClient: ApiClient;
  staffAuthClient: StaffAuthClient;
  /** Read fresh on every call so a language switch is reflected immediately -- the backend localizes response messages per this header (same convention as every other real staff client in this repo). */
  getLocale: () => 'en' | 'ur';
}

function toActorRef(actor: WorkflowStageCallScriptActorResponse | null): WorkflowStageCallScriptActorRef | undefined {
  return actor ? { id: actor.id, role: actor.role } : undefined;
}

function toWorkflowStageCallScript(data: WorkflowStageCallScriptResponse): WorkflowStageCallScript {
  return {
    workflowStageCode: data.workflow_stage_code as CanonicalWorkflowStageCode,
    announcementEn: data.announcement_en,
    announcementUr: data.announcement_ur ?? undefined,
    active: data.active,
    updatedBy: toActorRef(data.updated_by),
    updatedAt: data.updated_at,
  };
}

/** A StaffAuthError (from authenticatedDataRequest's own 401 refresh-and-retry path) has no `status`; anything else here is the raw ApiError authenticatedDataRequest rethrew unchanged. */
function isStaffAuthError(error: unknown): error is StaffAuthError {
  return !!error && typeof error === 'object' && 'code' in error && !('status' in error);
}

function toScriptError(error: unknown): WorkflowStageCallScriptError {
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

  return toScriptErrorFromStatus(apiError);
}

function toScriptErrorFromStatus(apiError: ApiError): WorkflowStageCallScriptError {
  if (apiError.status === 403) {
    const code: WorkflowStageCallScriptErrorCode = apiError.serverCode === 'inactive_account' ? 'INACTIVE_ACCOUNT' : 'FORBIDDEN';
    return { code, message: apiError.message };
  }
  if (apiError.status === 404) return { code: 'NOT_FOUND', message: apiError.message };
  if (apiError.status === 422) return { code: 'VALIDATION_FAILED', message: apiError.message, field: apiError.field };
  if (apiError.status >= 500) return { code: 'SERVER_ERROR' };

  return { code: 'UNKNOWN', message: apiError.message };
}

export function createAdminWorkflowStageCallScriptsClient(
  options: RealAdminWorkflowStageCallScriptsClientOptions
): AdminWorkflowStageCallScriptsClient {
  const { apiClient, staffAuthClient, getLocale } = options;

  return {
    async listWorkflowStageCallScripts(): Promise<WorkflowStageCallScript[]> {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.get<WorkflowStageCallScriptResponse[]>('/admin/workflow_stage_call_scripts', {
            headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() },
          })
        );
        return Array.isArray(data) ? data.map(toWorkflowStageCallScript) : [];
      } catch (error) {
        throw toScriptError(error);
      }
    },

    async updateWorkflowStageCallScript(
      workflowStageCode: CanonicalWorkflowStageCode,
      input: WorkflowStageCallScriptUpdateInput
    ): Promise<WorkflowStageCallScript> {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.patch<WorkflowStageCallScriptResponse>(
            `/admin/workflow_stage_call_scripts/${encodeURIComponent(workflowStageCode)}`,
            {
              workflow_stage_call_script: {
                announcement_en: input.announcementEn,
                announcement_ur: input.announcementUr,
                active: input.active,
              },
            },
            { headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() } }
          )
        );
        if (!data) throw { code: 'UNKNOWN' } satisfies WorkflowStageCallScriptError;
        return toWorkflowStageCallScript(data);
      } catch (error) {
        throw toScriptError(error);
      }
    },
  };
}

// Real ReferenceDataClient (see ./types.ts for the endpoints). Requests go
// through StaffAuthClient.authenticatedDataRequest so a 422 reaches the caller
// with its field and localized message.
import type { ApiClient, ApiError } from '../api-client';
import type { StaffAuthClient, StaffAuthError } from '../auth/staffTypes';
import type {
  ChecklistData,
  ChecklistRequirement,
  ChecklistRequirementInput,
  LookupInput,
  LookupKind,
  LookupRecord,
  MobilizationProcessRecord,
  ReferenceDataClient,
  ReferenceDataError,
  ReferenceDataErrorCode,
  RequirementLevel,
  RolePermissionsMatrix,
  ScopeRef,
  WorkflowStageRecord,
} from './types';

interface LookupResponse {
  code: string;
  name: string;
  name_en: string;
  name_ur: string;
  active: boolean;
  updated_at: string;
  is_driver?: boolean;
}

interface MatrixResponse {
  roles: Array<{ code: string; name: string; locked: boolean }>;
  permissions: Array<{ code: string; name: string; developer_only: boolean }>;
  grants: Record<string, string[]>;
}

interface RequirementResponse {
  id: string | number;
  document_type: ScopeRef;
  country: ScopeRef | null;
  project: ScopeRef | null;
  craft: ScopeRef | null;
  driver_only: boolean;
  requirement_level: RequirementLevel;
  active: boolean;
  minimum_files: number;
  maximum_files: number;
  accepted_content_types: string[];
  instructions_en: string | null;
  instructions_ur: string | null;
  updated_at: string;
}

interface ChecklistResponse {
  requirements: RequirementResponse[];
  document_types: ScopeRef[];
  content_types: string[];
}

interface StageResponse {
  code: string;
  position: number;
  name: string;
  default_name_en: string;
  default_name_ur: string;
  name_en: string | null;
  name_ur: string | null;
}

interface ProcessResponse {
  code: string;
  version: number;
  status: string;
  country: ScopeRef | null;
  published_at: string | null;
  stages: Array<{ position: number; code: string; name: string; required: boolean }>;
}

export interface RealReferenceDataClientOptions {
  apiClient: ApiClient;
  staffAuthClient: StaffAuthClient;
  getLocale: () => 'en' | 'ur';
  /** Fresh Idempotency-Key per create (tests pass a fixed one). */
  newIdempotencyKey?: () => string;
}

function toLookup(data: LookupResponse): LookupRecord {
  return {
    code: data.code,
    name: data.name,
    nameEn: data.name_en,
    nameUr: data.name_ur,
    active: data.active,
    updatedAt: data.updated_at,
    ...(typeof data.is_driver === 'boolean' ? { isDriver: data.is_driver } : {}),
  };
}

function toMatrix(data: MatrixResponse): RolePermissionsMatrix {
  return {
    roles: data.roles,
    permissions: data.permissions.map((p) => ({ code: p.code, name: p.name, developerOnly: p.developer_only })),
    grants: data.grants,
  };
}

function toRequirement(data: RequirementResponse): ChecklistRequirement {
  return {
    id: String(data.id),
    documentType: data.document_type,
    country: data.country,
    project: data.project,
    craft: data.craft,
    driverOnly: data.driver_only,
    requirementLevel: data.requirement_level,
    active: data.active,
    minimumFiles: data.minimum_files,
    maximumFiles: data.maximum_files,
    acceptedContentTypes: data.accepted_content_types,
    instructionsEn: data.instructions_en ?? '',
    instructionsUr: data.instructions_ur ?? '',
    updatedAt: data.updated_at,
  };
}

function toStage(data: StageResponse): WorkflowStageRecord {
  return {
    code: data.code,
    position: data.position,
    name: data.name,
    defaultNameEn: data.default_name_en,
    defaultNameUr: data.default_name_ur,
    nameEn: data.name_en,
    nameUr: data.name_ur,
  };
}

function toProcess(data: ProcessResponse): MobilizationProcessRecord {
  return {
    code: data.code,
    version: data.version,
    status: data.status,
    country: data.country,
    publishedAt: data.published_at,
    stages: data.stages,
  };
}

function requirementBody(input: ChecklistRequirementInput) {
  const body: Record<string, unknown> = {};
  if (input.requirementLevel !== undefined) body.requirement_level = input.requirementLevel;
  if (input.active !== undefined) body.active = input.active;
  if (input.maximumFiles !== undefined) body.maximum_files = input.maximumFiles;
  if (input.acceptedContentTypes !== undefined) body.accepted_content_types = input.acceptedContentTypes;
  if (input.instructionsEn !== undefined) body.instructions_en = input.instructionsEn;
  if (input.instructionsUr !== undefined) body.instructions_ur = input.instructionsUr;
  return body;
}

function isStaffAuthError(error: unknown): error is StaffAuthError {
  return !!error && typeof error === 'object' && 'code' in error && !('status' in error);
}

const PASSTHROUGH: ReferenceDataErrorCode[] = ['SESSION_EXPIRED', 'NETWORK_ERROR', 'OFFLINE'];

export function toReferenceDataError(error: unknown): ReferenceDataError {
  if (isStaffAuthError(error)) {
    return { code: PASSTHROUGH.includes(error.code as ReferenceDataErrorCode) ? (error.code as ReferenceDataErrorCode) : 'UNKNOWN' };
  }
  const apiError = error as ApiError;
  if (!apiError || typeof apiError !== 'object' || !('code' in apiError)) return { code: 'UNKNOWN' };
  if (apiError.code === 'OFFLINE') return { code: 'OFFLINE' };
  if (apiError.code === 'NETWORK_ERROR' || apiError.code === 'TIMEOUT') return { code: 'NETWORK_ERROR' };
  if (apiError.status === 403) return { code: 'FORBIDDEN', message: apiError.message };
  if (apiError.status === 409) return { code: 'STALE', message: apiError.message };
  if (apiError.status === 422) {
    if (apiError.serverCode === 'reference_data_in_use') return { code: 'IN_USE', message: apiError.message };
    return { code: 'VALIDATION_FAILED', message: apiError.message, field: apiError.field };
  }
  if (typeof apiError.status === 'number' && apiError.status >= 500) return { code: 'SERVER_ERROR' };
  return { code: 'UNKNOWN', message: apiError.message };
}

function defaultIdempotencyKey(): string {
  const cryptoApi = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  return `ref-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function createReferenceDataClient(options: RealReferenceDataClientOptions): ReferenceDataClient {
  const { apiClient, staffAuthClient, getLocale, newIdempotencyKey = defaultIdempotencyKey } = options;
  const headers = (token: string, extra: Record<string, string> = {}) => ({
    Authorization: `Bearer ${token}`,
    'X-Locale': getLocale(),
    ...extra,
  });

  async function run<T>(request: (token: string) => Promise<T>): Promise<T> {
    try {
      return await staffAuthClient.authenticatedDataRequest(request);
    } catch (error) {
      throw toReferenceDataError(error);
    }
  }

  function required<T>(data: T | null | undefined): T {
    if (data === null || data === undefined) throw { code: 'UNKNOWN' } satisfies ReferenceDataError;
    return data;
  }

  function lookupBody(kind: LookupKind, input: LookupInput) {
    return {
      ...(input.code !== undefined ? { code: input.code.trim() } : {}),
      name_en: input.nameEn.trim(),
      name_ur: input.nameUr.trim(),
      ...(kind === 'crafts' && input.isDriver !== undefined ? { is_driver: input.isDriver } : {}),
    };
  }

  const path = (kind: LookupKind, code?: string, suffix = '') =>
    `/admin/${kind}${code ? `/${encodeURIComponent(code)}` : ''}${suffix}`;

  return {
    async listLookups(kind) {
      const data = await run((token) =>
        apiClient.get<LookupResponse[]>(`${path(kind)}?include_retired=true`, { headers: headers(token) })
      );
      return (data ?? []).map(toLookup);
    },

    async createLookup(kind, input) {
      const key = newIdempotencyKey();
      const data = await run((token) =>
        apiClient.post<LookupResponse>(
          path(kind),
          { reference_data: lookupBody(kind, input) },
          { headers: headers(token, { 'Idempotency-Key': key }) }
        )
      );
      return toLookup(required(data));
    },

    async updateLookup(kind, code, input, expectedUpdatedAt) {
      const { code: _ignored, ...rest } = input;
      const data = await run((token) =>
        apiClient.patch<LookupResponse>(
          path(kind, code),
          { reference_data: { ...lookupBody(kind, rest), expected_updated_at: expectedUpdatedAt } },
          { headers: headers(token) }
        )
      );
      return toLookup(required(data));
    },

    async retireLookup(kind, code) {
      const data = await run((token) =>
        apiClient.post<LookupResponse>(path(kind, code, '/retirement'), undefined, { headers: headers(token) })
      );
      return toLookup(required(data));
    },

    async restoreLookup(kind, code) {
      const data = await run((token) =>
        apiClient.post<LookupResponse>(path(kind, code, '/restoration'), undefined, { headers: headers(token) })
      );
      return toLookup(required(data));
    },

    async deleteLookup(kind, code) {
      await run((token) => apiClient.del<unknown>(path(kind, code), { headers: headers(token) }));
    },

    async getRolePermissions() {
      const data = await run((token) => apiClient.get<MatrixResponse>('/admin/role_permissions', { headers: headers(token) }));
      return toMatrix(required(data));
    },

    async setRolePermissions(roleCode, permissionCodes) {
      const data = await run((token) =>
        apiClient.patch<MatrixResponse>(
          `/admin/role_permissions/${encodeURIComponent(roleCode)}`,
          { role_permission: { permission_codes: permissionCodes } },
          { headers: headers(token) }
        )
      );
      return toMatrix(required(data));
    },

    async getChecklist(): Promise<ChecklistData> {
      const data = required(
        await run((token) => apiClient.get<ChecklistResponse>('/admin/document_requirements', { headers: headers(token) }))
      );
      return {
        requirements: data.requirements.map(toRequirement),
        documentTypes: data.document_types,
        contentTypes: data.content_types,
      };
    },

    async createRequirement(input) {
      const key = newIdempotencyKey();
      const data = await run((token) =>
        apiClient.post<RequirementResponse>(
          '/admin/document_requirements',
          {
            document_requirement: {
              document_type_code: input.documentTypeCode,
              country_code: input.countryCode,
              ...requirementBody(input),
            },
          },
          { headers: headers(token, { 'Idempotency-Key': key }) }
        )
      );
      return toRequirement(required(data));
    },

    async updateRequirement(id, input, expectedUpdatedAt) {
      const data = await run((token) =>
        apiClient.patch<RequirementResponse>(
          `/admin/document_requirements/${encodeURIComponent(id)}`,
          { document_requirement: { ...requirementBody(input), expected_updated_at: expectedUpdatedAt } },
          { headers: headers(token) }
        )
      );
      return toRequirement(required(data));
    },

    async listWorkflowStages() {
      const data = await run((token) => apiClient.get<StageResponse[]>('/admin/workflow_stages', { headers: headers(token) }));
      return (data ?? []).map(toStage);
    },

    async updateWorkflowStage(code, names) {
      const data = await run((token) =>
        apiClient.patch<StageResponse>(
          `/admin/workflow_stages/${encodeURIComponent(code)}`,
          { workflow_stage: { name_en: names.nameEn.trim(), name_ur: names.nameUr.trim() } },
          { headers: headers(token) }
        )
      );
      return toStage(required(data));
    },

    async listMobilizationProcesses() {
      const data = await run((token) =>
        apiClient.get<ProcessResponse[]>('/admin/mobilization_processes', { headers: headers(token) })
      );
      return (data ?? []).map(toProcess);
    },
  };
}

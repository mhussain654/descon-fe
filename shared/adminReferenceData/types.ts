// Developer-only reference data management (`manage_reference_data`), wired to
// descon-be's openapi.yaml. Web-only.
//   Countries/projects/crafts: GET ?include_retired=true, POST, PATCH /{code},
//     POST /{code}/retirement, POST /{code}/restoration, DELETE /{code}
//   Role permissions:          GET /admin/role_permissions, PATCH /admin/role_permissions/{role_code}
//   Document checklists:       GET/POST /admin/document_requirements, PATCH /admin/document_requirements/{id}
//   Workflow stages:           GET /admin/workflow_stages, PATCH /admin/workflow_stages/{code}
//   Mobilization processes:    GET /admin/mobilization_processes (read-only)

export type LookupKind = 'countries' | 'projects' | 'crafts';

export interface LookupRecord {
  code: string;
  name: string;
  nameEn: string;
  nameUr: string;
  active: boolean;
  updatedAt: string;
  /** Crafts only. */
  isDriver?: boolean;
}

export interface LookupInput {
  code?: string;
  nameEn: string;
  nameUr: string;
  isDriver?: boolean;
}

export type ReferenceDataErrorCode =
  | 'VALIDATION_FAILED'
  | 'IN_USE'
  | 'STALE'
  | 'FORBIDDEN'
  | 'SESSION_EXPIRED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface ReferenceDataError {
  code: ReferenceDataErrorCode;
  message?: string;
  field?: string;
}

export interface RolePermissionsMatrix {
  roles: Array<{ code: string; name: string; locked: boolean }>;
  permissions: Array<{ code: string; name: string; developerOnly: boolean }>;
  /** role code -> granted permission codes */
  grants: Record<string, string[]>;
}

export type RequirementLevel = 'required' | 'optional' | 'not_applicable';

export interface ScopeRef {
  code: string;
  name: string;
}

export interface ChecklistRequirement {
  id: string;
  documentType: ScopeRef;
  /** null = common to every country. */
  country: ScopeRef | null;
  project: ScopeRef | null;
  craft: ScopeRef | null;
  driverOnly: boolean;
  requirementLevel: RequirementLevel;
  active: boolean;
  minimumFiles: number;
  maximumFiles: number;
  acceptedContentTypes: string[];
  instructionsEn: string;
  instructionsUr: string;
  updatedAt: string;
}

export interface ChecklistRequirementInput {
  requirementLevel?: RequirementLevel;
  active?: boolean;
  maximumFiles?: number;
  acceptedContentTypes?: string[];
  instructionsEn?: string;
  instructionsUr?: string;
}

export interface ChecklistRequirementCreateInput extends ChecklistRequirementInput {
  documentTypeCode: string;
  /** null = common to every country. */
  countryCode: string | null;
}

export interface ChecklistData {
  requirements: ChecklistRequirement[];
  documentTypes: ScopeRef[];
  contentTypes: string[];
}

export interface WorkflowStageRecord {
  code: string;
  position: number;
  /** The name shown now (override if set, else the built-in one). */
  name: string;
  defaultNameEn: string;
  defaultNameUr: string;
  nameEn: string | null;
  nameUr: string | null;
}

export interface MobilizationProcessRecord {
  code: string;
  version: number;
  status: string;
  country: ScopeRef | null;
  publishedAt: string | null;
  stages: Array<{ position: number; code: string; name: string; required: boolean }>;
}

export interface ReferenceDataClient {
  listLookups(kind: LookupKind): Promise<LookupRecord[]>;
  createLookup(kind: LookupKind, input: LookupInput): Promise<LookupRecord>;
  updateLookup(kind: LookupKind, code: string, input: LookupInput, expectedUpdatedAt: string): Promise<LookupRecord>;
  retireLookup(kind: LookupKind, code: string): Promise<LookupRecord>;
  restoreLookup(kind: LookupKind, code: string): Promise<LookupRecord>;
  deleteLookup(kind: LookupKind, code: string): Promise<void>;
  getRolePermissions(): Promise<RolePermissionsMatrix>;
  setRolePermissions(roleCode: string, permissionCodes: string[]): Promise<RolePermissionsMatrix>;
  getChecklist(): Promise<ChecklistData>;
  createRequirement(input: ChecklistRequirementCreateInput): Promise<ChecklistRequirement>;
  updateRequirement(id: string, input: ChecklistRequirementInput, expectedUpdatedAt: string): Promise<ChecklistRequirement>;
  listWorkflowStages(): Promise<WorkflowStageRecord[]>;
  updateWorkflowStage(code: string, names: { nameEn: string; nameUr: string }): Promise<WorkflowStageRecord>;
  listMobilizationProcesses(): Promise<MobilizationProcessRecord[]>;
}

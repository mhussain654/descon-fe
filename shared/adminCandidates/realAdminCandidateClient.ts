// Real AdminCandidateClient implementation (MPS-F301), calling the backend
// contract documented in descon-be's
// feat/mps-f301-admin-candidate-creation-profile-editing branch:
//   POST  /api/v1/admin/candidates
//   GET   /api/v1/admin/candidates/:id
//   PATCH /api/v1/admin/candidates/:id
//   GET   /api/v1/admin/countries
//   GET   /api/v1/admin/projects
//   GET   /api/v1/admin/crafts
//
// Authentication goes through StaffAuthClient.authenticatedDataRequest, not
// authenticatedRequest -- matches the established adminWorkflow/
// adminDocumentReviews precedent, so a 409 stale-expectation/idempotency
// conflict or a 422 duplicate/validation error reaches the caller intact.
import type { ApiClient, ApiError } from '../api-client';
import type { StaffAuthClient, StaffAuthError } from '../auth/staffTypes';
import { buildCandidateListQuery } from './candidateListQueryParams';
import type {
  AdminCandidateAssignmentSummary,
  AdminCandidateClient,
  AdminCandidateDetail,
  AdminCandidateError,
  AdminCandidateErrorCode,
  AdminCandidateListFilters,
  AdminCandidateListPage,
  AdminCandidateListResult,
  AdminCandidateListSort,
  AdminCandidatePagination,
  CreateCandidateInput,
  NextOfKinDetail,
  NextOfKinInput,
  ReferenceDataItem,
  UpdateCandidateInput,
} from './types';

interface ReferenceDataItemResponse {
  code: string;
  name: string;
}

interface AssignmentSummaryResponse {
  id: string;
  reference_number: string;
  country: ReferenceDataItemResponse;
  project: ReferenceDataItemResponse;
  craft: ReferenceDataItemResponse;
  current_workflow_stage: { code: string; name: string };
  created_at: string;
}

interface CandidateDetailResponse {
  id: string;
  full_name: string;
  cnic: string;
  mobile_number: string;
  passport_number: string | null;
  next_of_kin_name: string | null;
  next_of_kin_relationship: string | null;
  next_of_kin_mobile_number: string | null;
  next_of_kin_cnic: string | null;
  preferred_locale: string;
  candidate_status: string;
  active: boolean;
  created_at: string;
  updated_at: string | null;
  assignment: AssignmentSummaryResponse | null;
}

export interface RealAdminCandidateClientOptions {
  apiClient: ApiClient;
  staffAuthClient: StaffAuthClient;
  /** Read fresh on every call so a language switch is reflected immediately -- the backend localizes reference-data names and messages per this header. */
  getLocale: () => 'en' | 'ur';
}

const KNOWN_LOCALES = new Set<string>(['en', 'ur']);

function toLocale(raw: unknown): 'en' | 'ur' {
  return typeof raw === 'string' && KNOWN_LOCALES.has(raw) ? (raw as 'en' | 'ur') : 'en';
}

function toReferenceDataItem(raw: unknown): ReferenceDataItem {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<ReferenceDataItemResponse>;
  return {
    code: typeof value.code === 'string' ? value.code : '',
    name: typeof value.name === 'string' ? value.name : '',
  };
}

function toReferenceDataItems(raw: unknown): ReferenceDataItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(toReferenceDataItem);
}

function toAssignmentSummary(raw: unknown): AdminCandidateAssignmentSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<AssignmentSummaryResponse>;
  if (typeof value.id !== 'string' || !value.id) return null;

  const stage = (value.current_workflow_stage && typeof value.current_workflow_stage === 'object'
    ? value.current_workflow_stage
    : {}) as { code?: unknown; name?: unknown };

  return {
    id: value.id,
    referenceNumber: typeof value.reference_number === 'string' ? value.reference_number : '',
    country: toReferenceDataItem(value.country),
    project: toReferenceDataItem(value.project),
    craft: toReferenceDataItem(value.craft),
    currentWorkflowStage: {
      code: typeof stage.code === 'string' ? stage.code : '',
      name: typeof stage.name === 'string' ? stage.name : '',
    },
    createdAt: typeof value.created_at === 'string' ? value.created_at : '',
  };
}

function toNextOfKin(value: Partial<CandidateDetailResponse>): NextOfKinDetail {
  return {
    name: typeof value.next_of_kin_name === 'string' ? value.next_of_kin_name : null,
    relationship: typeof value.next_of_kin_relationship === 'string' ? value.next_of_kin_relationship : null,
    mobileNumber: typeof value.next_of_kin_mobile_number === 'string' ? value.next_of_kin_mobile_number : null,
    cnic: typeof value.next_of_kin_cnic === 'string' ? value.next_of_kin_cnic : null,
  };
}

interface PaginationResponse {
  page: number;
  per_page: number;
  total_count: number;
  total_pages: number;
}

function toPagination(raw: unknown): AdminCandidatePagination {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<PaginationResponse>;
  return {
    page: typeof value.page === 'number' ? value.page : 1,
    perPage: typeof value.per_page === 'number' ? value.per_page : 0,
    totalCount: typeof value.total_count === 'number' ? value.total_count : 0,
    totalPages: typeof value.total_pages === 'number' ? value.total_pages : 0,
  };
}

function toAppliedFilters(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(Object.entries(raw as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

function toCandidateDetail(raw: unknown): AdminCandidateDetail {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<CandidateDetailResponse>;
  return {
    id: typeof value.id === 'string' ? value.id : '',
    fullName: typeof value.full_name === 'string' ? value.full_name : '',
    cnic: typeof value.cnic === 'string' ? value.cnic : '',
    mobileNumber: typeof value.mobile_number === 'string' ? value.mobile_number : '',
    passportNumber: typeof value.passport_number === 'string' ? value.passport_number : null,
    nextOfKin: toNextOfKin(value),
    preferredLocale: toLocale(value.preferred_locale),
    candidateStatus: typeof value.candidate_status === 'string' ? value.candidate_status : '',
    active: value.active === true,
    createdAt: typeof value.created_at === 'string' ? value.created_at : '',
    updatedAt: typeof value.updated_at === 'string' ? value.updated_at : null,
    assignment: toAssignmentSummary(value.assignment),
  };
}

/** Maps the backend's ErrorItem.code (see openapi.yaml's admin/candidates 409/422 examples) to the shared error taxonomy. */
const SERVER_CODE_TO_ERROR: Record<string, AdminCandidateErrorCode> = {
  validation_failed: 'VALIDATION_ERROR',
  duplicate_cnic: 'DUPLICATE_CNIC',
  duplicate_passport_number: 'DUPLICATE_PASSPORT_NUMBER',
  duplicate_reference_number: 'DUPLICATE_REFERENCE_NUMBER',
  candidate_assignment_field_locked: 'ASSIGNMENT_FIELD_LOCKED',
  stale_candidate: 'STALE_CANDIDATE',
  idempotency_conflict: 'IDEMPOTENCY_CONFLICT',
  missing_idempotency_key: 'MISSING_IDEMPOTENCY_KEY',
  invalid_idempotency_key: 'INVALID_IDEMPOTENCY_KEY',
  idempotency_in_progress: 'IDEMPOTENCY_IN_PROGRESS',
  inactive_account: 'INACTIVE_ACCOUNT',
  not_found: 'NOT_FOUND',
  unsupported_filter: 'VALIDATION_ERROR',
  unsupported_sort: 'VALIDATION_ERROR',
  invalid_query_parameter: 'VALIDATION_ERROR',
};

function isStaffAuthError(error: unknown): error is StaffAuthError {
  return !!error && typeof error === 'object' && 'code' in error && !('status' in error);
}

function toCandidateError(error: unknown): AdminCandidateError {
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
  if (mapped) {
    return { code: mapped, message: apiError.message, field: apiError.field };
  }

  if (apiError.status === 400) return { code: 'VALIDATION_ERROR', message: apiError.message, field: apiError.field };
  if (apiError.status === 403) return { code: 'FORBIDDEN', message: apiError.message };
  if (apiError.status === 404) return { code: 'NOT_FOUND', message: apiError.message };
  if (apiError.status === 409) return { code: 'STALE_CANDIDATE', message: apiError.message };
  if (apiError.status === 422) return { code: 'VALIDATION_ERROR', message: apiError.message, field: apiError.field };
  if (apiError.status === 429) return { code: 'RATE_LIMITED', retryAfterSeconds: apiError.retryAfterSeconds };
  if (apiError.status >= 500) return { code: 'SERVER_ERROR' };

  return { code: 'UNKNOWN', message: apiError.message };
}

/** Drops undefined entries so only fields the caller actually set are sent -- an omitted key must never be interpreted by the backend as "clear this field." */
function compactBody(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

/** All four next-of-kin fields together, or nothing -- never a partial group. Omitting `nextOfKin` entirely (as opposed to sending it with blank fields) is what leaves an existing group completely untouched. */
function nextOfKinBody(nextOfKin: NextOfKinInput | undefined): Record<string, unknown> {
  if (!nextOfKin) return {};
  return {
    next_of_kin_name: nextOfKin.name,
    next_of_kin_relationship: nextOfKin.relationship,
    next_of_kin_mobile_number: nextOfKin.mobileNumber,
    next_of_kin_cnic: nextOfKin.cnic,
  };
}

export function createAdminCandidateClient(options: RealAdminCandidateClientOptions): AdminCandidateClient {
  const { apiClient, staffAuthClient, getLocale } = options;

  async function getReferenceData(path: string): Promise<ReferenceDataItem[]> {
    try {
      const data = await staffAuthClient.authenticatedDataRequest((token) =>
        apiClient.get<ReferenceDataItemResponse[]>(path, {
          headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() },
        })
      );
      return toReferenceDataItems(data);
    } catch (error) {
      throw toCandidateError(error);
    }
  }

  return {
    async getCandidate(candidateId: string): Promise<AdminCandidateDetail> {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.get<CandidateDetailResponse>(`/admin/candidates/${encodeURIComponent(candidateId)}`, {
            headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() },
          })
        );
        return toCandidateDetail(data);
      } catch (error) {
        throw toCandidateError(error);
      }
    },

    async listCandidates(
      filters: AdminCandidateListFilters,
      sort: AdminCandidateListSort | undefined,
      page: AdminCandidateListPage
    ): Promise<AdminCandidateListResult> {
      const query = buildCandidateListQuery(filters, sort, page);
      try {
        const result = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.getWithMeta<CandidateDetailResponse[]>(`/admin/candidates${query}`, {
            headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() },
          })
        );
        if (!result) throw { code: 'UNKNOWN' } satisfies AdminCandidateError;

        const items = Array.isArray(result.data) ? result.data.map(toCandidateDetail) : [];
        const meta = result.meta as { pagination?: unknown; applied_filters?: unknown } | undefined;
        return {
          items,
          pagination: toPagination(meta?.pagination),
          appliedFilters: toAppliedFilters(meta?.applied_filters),
        };
      } catch (error) {
        throw toCandidateError(error);
      }
    },

    async createCandidate(input: CreateCandidateInput): Promise<AdminCandidateDetail> {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.post<CandidateDetailResponse>(
            '/admin/candidates',
            {
              candidate: {
                full_name: input.fullName,
                cnic: input.cnic,
                mobile_number: input.mobileNumber,
                ...(input.passportNumber ? { passport_number: input.passportNumber } : {}),
                ...nextOfKinBody(input.nextOfKin),
                preferred_locale: input.preferredLocale,
                country_code: input.countryCode,
                project_code: input.projectCode,
                craft_code: input.craftCode,
                reference_number: input.referenceNumber,
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
        return toCandidateDetail(data);
      } catch (error) {
        throw toCandidateError(error);
      }
    },

    async updateCandidate(input: UpdateCandidateInput): Promise<AdminCandidateDetail> {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.patch<CandidateDetailResponse>(
            `/admin/candidates/${encodeURIComponent(input.candidateId)}`,
            {
              candidate: compactBody({
                full_name: input.fullName,
                mobile_number: input.mobileNumber,
                passport_number: input.passportNumber,
                ...nextOfKinBody(input.nextOfKin),
                preferred_locale: input.preferredLocale,
                country_code: input.countryCode,
                project_code: input.projectCode,
                craft_code: input.craftCode,
                expected_updated_at: input.expectedUpdatedAt,
              }),
            },
            { headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() } }
          )
        );
        return toCandidateDetail(data);
      } catch (error) {
        throw toCandidateError(error);
      }
    },

    getCountries: () => getReferenceData('/admin/countries'),
    getProjects: () => getReferenceData('/admin/projects'),
    getCrafts: () => getReferenceData('/admin/crafts'),
  };
}

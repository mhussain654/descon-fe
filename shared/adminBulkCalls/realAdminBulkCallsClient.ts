// Real AdminBulkCallsClient implementation, calling the backend documented in
// descon-be's openapi.yaml (see ./types.ts for the endpoint list).
//
// Authentication goes through StaffAuthClient.authenticatedDataRequest, not
// authenticatedRequest -- a 404/422/429's own shape must reach this file intact
// (same rationale as realAdminCandidateAiCallsClient.ts). Starting a batch sends
// the caller's Idempotency-Key.
import type { ApiClient, ApiError } from '../api-client';
import type { StaffAuthClient, StaffAuthError } from '../auth/staffTypes';
import type {
  AdminBulkCallError,
  AdminBulkCallErrorCode,
  AdminBulkCallsClient,
  BulkCallBatch,
  BulkCallBatchItem,
  BulkCallBatchItemCall,
  BulkCallCandidateRow,
  BulkCallCandidatesQuery,
  BulkCallCandidatesResult,
  BulkCallItemStatus,
  BulkCallPagination,
  BulkCallState,
  BulkCallSummary,
  RobocallVoice,
  RobocallVoiceInput,
  StartBulkCallInput,
} from './types';

interface VoiceResponse {
  id: string;
  name_en: string;
  name_ur: string | null;
  voice_id: string;
  active: boolean;
  updated_at: string;
}

interface CandidateRowResponse {
  id: string;
  full_name: string;
  reference_number: string | null;
  mobile_number_masked: string;
  call_state: BulkCallState;
  last_call: { status: string; outcome: string | null; outcome_reason: string | null; called_at: string } | null;
}

interface BatchItemResponse {
  id: number;
  candidate: { id: string; full_name: string; mobile_number_masked: string };
  status: BulkCallItemStatus;
  skip_reason: string | null;
  call: {
    id: string;
    status: string;
    outcome: string | null;
    outcome_reason: string | null;
    callback_requested_at: string | null;
  } | null;
}

interface BatchResponse {
  id: string;
  voice: { id: string; name: string };
  workflow_stage_code: string;
  filters: Record<string, string> | null;
  requested_limit: number;
  selected_count: number;
  counts: Partial<Record<BulkCallItemStatus, number>>;
  created_by: { id: string; role: string };
  created_at: string;
  items?: BatchItemResponse[];
}

export interface RealAdminBulkCallsClientOptions {
  apiClient: ApiClient;
  staffAuthClient: StaffAuthClient;
  /** Read fresh on every call so a language switch is reflected immediately -- the backend localizes response messages per this header. */
  getLocale: () => 'en' | 'ur';
}

const ITEM_STATUSES: BulkCallItemStatus[] = ['queued', 'placed', 'skipped', 'failed'];

function toVoice(data: VoiceResponse): RobocallVoice {
  return {
    id: data.id,
    nameEn: data.name_en,
    nameUr: data.name_ur ?? undefined,
    voiceId: data.voice_id,
    active: data.active,
    updatedAt: data.updated_at,
  };
}

function toCandidateRow(data: CandidateRowResponse): BulkCallCandidateRow {
  return {
    id: data.id,
    fullName: data.full_name,
    referenceNumber: data.reference_number ?? undefined,
    mobileNumberMasked: data.mobile_number_masked,
    callState: data.call_state,
    lastCall: data.last_call
      ? {
          status: data.last_call.status,
          outcome: data.last_call.outcome ?? undefined,
          outcomeReason: data.last_call.outcome_reason ?? undefined,
          calledAt: data.last_call.called_at,
        }
      : undefined,
  };
}

function toItemCall(call: NonNullable<BatchItemResponse['call']>): BulkCallBatchItemCall {
  return {
    id: call.id,
    status: call.status,
    outcome: call.outcome ?? undefined,
    outcomeReason: call.outcome_reason ?? undefined,
    callbackRequestedAt: call.callback_requested_at ?? undefined,
  };
}

function toBatchItem(data: BatchItemResponse): BulkCallBatchItem {
  return {
    id: data.id,
    candidate: {
      id: data.candidate.id,
      fullName: data.candidate.full_name,
      mobileNumberMasked: data.candidate.mobile_number_masked,
    },
    status: data.status,
    skipReason: data.skip_reason ?? undefined,
    call: data.call ? toItemCall(data.call) : undefined,
  };
}

function toBatch(data: BatchResponse): BulkCallBatch {
  return {
    id: data.id,
    voice: data.voice,
    workflowStageCode: data.workflow_stage_code,
    filters: data.filters ?? {},
    requestedLimit: data.requested_limit,
    selectedCount: data.selected_count,
    counts: Object.fromEntries(ITEM_STATUSES.map((status) => [status, data.counts?.[status] ?? 0])) as Record<
      BulkCallItemStatus,
      number
    >,
    createdBy: data.created_by,
    createdAt: data.created_at,
    items: data.items ? data.items.map(toBatchItem) : undefined,
  };
}

function toPagination(raw: unknown): BulkCallPagination {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    page: typeof value.page === 'number' ? value.page : 1,
    perPage: typeof value.per_page === 'number' ? value.per_page : 0,
    totalCount: typeof value.total_count === 'number' ? value.total_count : 0,
    totalPages: typeof value.total_pages === 'number' ? value.total_pages : 0,
  };
}

function toSummary(raw: unknown): BulkCallSummary {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const count = (key: string) => (typeof value[key] === 'number' ? (value[key] as number) : 0);
  return { matching: count('matching'), called: count('called'), remaining: count('remaining') };
}

function buildCandidatesQuery(query: BulkCallCandidatesQuery): string {
  const params = new URLSearchParams();
  params.set('robocall_voice_id', query.voiceId);
  params.set('filter[status]', query.stageCode);
  if (query.countryCode) params.set('filter[country_code]', query.countryCode);
  if (query.projectCode) params.set('filter[project_code]', query.projectCode);
  if (query.craftCode) params.set('filter[craft_code]', query.craftCode);
  if (query.search) params.set('search', query.search);
  params.set('called', query.called);
  params.set('page[number]', String(query.page));
  params.set('page[size]', String(query.pageSize));
  return `?${params.toString()}`;
}

/** Maps the backend's ErrorItem.code to the shared error taxonomy. */
const SERVER_CODE_TO_ERROR: Partial<Record<string, AdminBulkCallErrorCode>> = {
  validation_failed: 'VALIDATION_FAILED',
  idempotency_conflict: 'IDEMPOTENCY_CONFLICT',
  missing_idempotency_key: 'MISSING_IDEMPOTENCY_KEY',
  invalid_idempotency_key: 'MISSING_IDEMPOTENCY_KEY',
  idempotency_in_progress: 'RATE_LIMITED',
  inactive_account: 'INACTIVE_ACCOUNT',
  ai_call_bulk_nothing_to_call: 'NOTHING_TO_CALL',
  ai_call_outside_calling_hours: 'OUTSIDE_CALLING_HOURS',
  ai_call_daily_limit_reached: 'DAILY_LIMIT_REACHED',
  ai_call_outbound_disabled: 'CALLING_DISABLED',
  ai_call_voice_not_configured: 'CALLING_DISABLED',
};

/** A StaffAuthError (from authenticatedDataRequest's own 401 refresh-and-retry path) has no `status`; anything else here is the raw ApiError authenticatedDataRequest rethrew unchanged. */
function isStaffAuthError(error: unknown): error is StaffAuthError {
  return !!error && typeof error === 'object' && 'code' in error && !('status' in error);
}

function toBulkCallError(error: unknown): AdminBulkCallError {
  if (isStaffAuthError(error)) {
    if (error.code === 'SESSION_EXPIRED') return { code: 'SESSION_EXPIRED' };
    if (error.code === 'NETWORK_ERROR') return { code: 'NETWORK_ERROR' };
    if (error.code === 'OFFLINE') return { code: 'OFFLINE' };
    return { code: 'UNKNOWN' };
  }

  const apiError = error as ApiError;
  if (!apiError || typeof apiError !== 'object' || !('code' in apiError)) return { code: 'UNKNOWN' };

  if (apiError.code === 'OFFLINE') return { code: 'OFFLINE' };
  if (apiError.code === 'NETWORK_ERROR' || apiError.code === 'TIMEOUT') return { code: 'NETWORK_ERROR' };
  if (apiError.code === 'CANCELLED') return { code: 'UNKNOWN' };

  const mapped = apiError.serverCode ? SERVER_CODE_TO_ERROR[apiError.serverCode] : undefined;
  if (mapped) return { code: mapped, message: apiError.message, field: apiError.field };

  return toBulkCallErrorFromStatus(apiError);
}

function toBulkCallErrorFromStatus(apiError: ApiError): AdminBulkCallError {
  if (apiError.status === 403) return { code: 'FORBIDDEN', message: apiError.message };
  if (apiError.status === 404) return { code: 'NOT_FOUND', message: apiError.message };
  if (apiError.status === 409) return { code: 'IDEMPOTENCY_CONFLICT', message: apiError.message };
  if (apiError.status === 422) return { code: 'VALIDATION_FAILED', message: apiError.message, field: apiError.field };
  if (apiError.status === 429) return { code: 'RATE_LIMITED', message: apiError.message };
  if (apiError.status >= 500) return { code: 'SERVER_ERROR' };

  return { code: 'UNKNOWN', message: apiError.message };
}

export function createAdminBulkCallsClient(options: RealAdminBulkCallsClientOptions): AdminBulkCallsClient {
  const { apiClient, staffAuthClient, getLocale } = options;

  const headers = (token: string, extra: Record<string, string> = {}) => ({
    Authorization: `Bearer ${token}`,
    'X-Locale': getLocale(),
    ...extra,
  });

  async function guarded<T>(request: () => Promise<T>): Promise<T> {
    try {
      return await request();
    } catch (error) {
      throw toBulkCallError(error);
    }
  }

  function required<T>(data: T | undefined): T {
    if (data === undefined) throw { code: 'UNKNOWN' } satisfies AdminBulkCallError;
    return data;
  }

  return {
    listVoices: () =>
      guarded(async () => {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.get<VoiceResponse[]>('/admin/robocall_voices', { headers: headers(token) })
        );
        return Array.isArray(data) ? data.map(toVoice) : [];
      }),

    createVoice: (input: RobocallVoiceInput) =>
      guarded(async () => {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.post<VoiceResponse>(
            '/admin/robocall_voices',
            { robocall_voice: { name_en: input.nameEn, name_ur: input.nameUr.trim() || null, voice_id: input.voiceId, active: input.active } },
            { headers: headers(token) }
          )
        );
        return toVoice(required(data));
      }),

    updateVoice: (id: string, input: Partial<RobocallVoiceInput>) =>
      guarded(async () => {
        const body: Record<string, unknown> = {};
        if (input.nameEn !== undefined) body.name_en = input.nameEn;
        if (input.nameUr !== undefined) body.name_ur = input.nameUr.trim() || null;
        if (input.voiceId !== undefined) body.voice_id = input.voiceId;
        if (input.active !== undefined) body.active = input.active;
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.patch<VoiceResponse>(`/admin/robocall_voices/${encodeURIComponent(id)}`, { robocall_voice: body }, { headers: headers(token) })
        );
        return toVoice(required(data));
      }),

    listCandidates: (query: BulkCallCandidatesQuery) =>
      guarded(async (): Promise<BulkCallCandidatesResult> => {
        const result = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.getWithMeta<CandidateRowResponse[]>(`/admin/bulk_calls/candidates${buildCandidatesQuery(query)}`, {
            headers: headers(token),
          })
        );
        const envelope = required(result);
        const meta = envelope.meta as { pagination?: unknown; summary?: unknown; batch_limit?: unknown } | undefined;
        return {
          candidates: Array.isArray(envelope.data) ? envelope.data.map(toCandidateRow) : [],
          pagination: toPagination(meta?.pagination),
          summary: toSummary(meta?.summary),
          batchLimit: typeof meta?.batch_limit === 'number' ? meta.batch_limit : 0,
        };
      }),

    startBatch: (input: StartBulkCallInput) =>
      guarded(async () => {
        const filter: Record<string, string> = {};
        if (input.countryCode) filter.country_code = input.countryCode;
        if (input.projectCode) filter.project_code = input.projectCode;
        if (input.craftCode) filter.craft_code = input.craftCode;
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.post<BatchResponse>(
            '/admin/bulk_calls',
            {
              bulk_call: {
                robocall_voice_id: input.voiceId,
                workflow_stage_code: input.stageCode,
                limit: input.limit,
                ...(input.search ? { search: input.search } : {}),
                ...(Object.keys(filter).length > 0 ? { filter } : {}),
              },
            },
            { headers: headers(token, { 'Idempotency-Key': input.idempotencyKey }) }
          )
        );
        return toBatch(required(data));
      }),

    listBatches: () =>
      guarded(async () => {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.get<BatchResponse[]>('/admin/bulk_calls', { headers: headers(token) })
        );
        return Array.isArray(data) ? data.map(toBatch) : [];
      }),

    getBatch: (id: string) =>
      guarded(async () => {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.get<BatchResponse>(`/admin/bulk_calls/${encodeURIComponent(id)}`, { headers: headers(token) })
        );
        return toBatch(required(data));
      }),
  };
}

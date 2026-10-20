// Admin bulk voice calls, wired to the backend documented in descon-be's
// openapi.yaml:
//   GET/POST /api/v1/admin/robocall_voices, PATCH /api/v1/admin/robocall_voices/{id}
//   GET      /api/v1/admin/bulk_calls/candidates
//   GET/POST /api/v1/admin/bulk_calls, GET /api/v1/admin/bulk_calls/{id}
//
// A "call type" is a named RoboCall voice. An admin picks one workflow stage and
// one call type, sees which of that stage's candidates were already called with it,
// and starts a batch for the next few (at most the batch limit). Web-only
// (AGENTS.md: "administrative workflows remain web-focused").

export interface RobocallVoice {
  id: string;
  nameEn: string;
  nameUr?: string;
  /** The RoboCall voice that is played. */
  voiceId: string;
  active: boolean;
  updatedAt: string;
}

export interface RobocallVoiceInput {
  nameEn: string;
  nameUr: string;
  voiceId: string;
  active: boolean;
}

export type BulkCallState = 'not_called' | 'queued' | 'called';
export type BulkCallCalledFilter = 'not_called' | 'called' | 'all';

export interface BulkCallLastCall {
  status: string;
  outcome?: string;
  outcomeReason?: string;
  calledAt: string;
}

export interface BulkCallCandidateRow {
  id: string;
  fullName: string;
  referenceNumber?: string;
  mobileNumberMasked: string;
  callState: BulkCallState;
  lastCall?: BulkCallLastCall;
}

export interface BulkCallSummary {
  /** Everyone at the stage (and filters) who is active. */
  matching: number;
  called: number;
  remaining: number;
}

export interface BulkCallPagination {
  page: number;
  perPage: number;
  totalCount: number;
  totalPages: number;
}

export interface BulkCallCandidatesQuery {
  voiceId: string;
  stageCode: string;
  countryCode?: string;
  projectCode?: string;
  craftCode?: string;
  search?: string;
  called: BulkCallCalledFilter;
  page: number;
  pageSize: number;
}

export interface BulkCallCandidatesResult {
  candidates: BulkCallCandidateRow[];
  pagination: BulkCallPagination;
  summary: BulkCallSummary;
  /** The most candidates one batch may call (the backend enforces it). */
  batchLimit: number;
}

export interface StartBulkCallInput {
  voiceId: string;
  stageCode: string;
  limit: number;
  countryCode?: string;
  projectCode?: string;
  craftCode?: string;
  search?: string;
  idempotencyKey: string;
}

export type BulkCallItemStatus = 'queued' | 'placed' | 'skipped' | 'failed';

export interface BulkCallBatchItemCall {
  id: string;
  status: string;
  outcome?: string;
  outcomeReason?: string;
  callbackRequestedAt?: string;
}

export interface BulkCallBatchItem {
  id: number;
  candidate: { id: string; fullName: string; mobileNumberMasked: string };
  status: BulkCallItemStatus;
  /** Why a candidate was skipped, or the provider failed, e.g. `stage_changed`. */
  skipReason?: string;
  call?: BulkCallBatchItemCall;
}

export interface BulkCallBatch {
  id: string;
  voice: { id: string; name: string };
  workflowStageCode: string;
  filters: Record<string, string>;
  requestedLimit: number;
  selectedCount: number;
  counts: Record<BulkCallItemStatus, number>;
  createdBy: { id: string; role: string };
  createdAt: string;
  /** Only present on a single batch's detail, not in the recent-batches list. */
  items?: BulkCallBatchItem[];
}

export type AdminBulkCallErrorCode =
  | 'VALIDATION_FAILED'
  | 'FORBIDDEN'
  | 'INACTIVE_ACCOUNT'
  | 'SESSION_EXPIRED'
  | 'NOT_FOUND'
  | 'NOTHING_TO_CALL'
  | 'OUTSIDE_CALLING_HOURS'
  | 'DAILY_LIMIT_REACHED'
  | 'CALLING_DISABLED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'MISSING_IDEMPOTENCY_KEY'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface AdminBulkCallError {
  code: AdminBulkCallErrorCode;
  /** Already-localized server message, when the backend provided one. */
  message?: string;
  field?: string;
}

export interface AdminBulkCallsClient {
  listVoices(): Promise<RobocallVoice[]>;
  createVoice(input: RobocallVoiceInput): Promise<RobocallVoice>;
  updateVoice(id: string, input: Partial<RobocallVoiceInput>): Promise<RobocallVoice>;
  listCandidates(query: BulkCallCandidatesQuery): Promise<BulkCallCandidatesResult>;
  startBatch(input: StartBulkCallInput): Promise<BulkCallBatch>;
  listBatches(): Promise<BulkCallBatch[]>;
  getBatch(id: string): Promise<BulkCallBatch>;
}

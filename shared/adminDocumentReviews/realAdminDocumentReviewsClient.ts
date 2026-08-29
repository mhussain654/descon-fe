// Real AdminDocumentReviewsClient implementation, calling the backend
// documented in descon-be's merged admin-review contract:
//   GET  /api/v1/admin/document_submissions
//   GET  /api/v1/admin/document_submissions/:id
//   POST /api/v1/admin/candidate_documents/:id/access
//   POST /api/v1/admin/candidate_documents/:id/verifications
//   POST /api/v1/admin/candidate_documents/:id/rejections
//
// Authentication goes through StaffAuthClient.authenticatedDataRequest, not
// authenticatedRequest -- these calls' own success/error shape (queue
// pagination, a 409 idempotency conflict, a 422 rejection-reason validation
// error) must reach the caller intact, matching the established
// adminCandidateImport precedent (see its realCandidateImportClient.ts).
import type { ApiClient, ApiError } from '../api-client';
import type { StaffAuthClient, StaffAuthError } from '../auth/staffTypes';
import { buildDocumentReviewQueueQuery } from './queueQueryParams';
import type {
  AdminDocumentReviewError,
  AdminDocumentReviewErrorCode,
  AdminDocumentReviewsClient,
  DocumentAccess,
  DocumentDisplayStatus,
  DocumentReviewQueueFilters,
  DocumentReviewQueueItem,
  DocumentReviewQueuePage,
  DocumentReviewQueueResult,
  DocumentReviewQueueSummary,
  DocumentSubmissionDetail,
  QueueAssignment,
  QueueCandidate,
  QueuePagination,
  ReferenceCode,
  ReviewDecisionResult,
  ReviewDisplayState,
  ReviewerDisplayRole,
  ReviewerInfo,
  ReviewSummary,
  SubmissionDocument,
} from './types';

interface ReferenceCodeResponse {
  code: string;
  name: string;
}

interface QueueCandidateResponse {
  id: string;
  full_name: string;
}

interface QueueAssignmentResponse {
  id: string;
  reference_number: string;
  country: ReferenceCodeResponse;
  project: ReferenceCodeResponse;
  craft: ReferenceCodeResponse;
}

interface ReviewSummaryResponse {
  pending_review: number;
  verified: number;
  rejected: number;
  required_total: number;
  review_state: string;
}

interface QueueItemResponse {
  id: string;
  candidate: QueueCandidateResponse;
  assignment: QueueAssignmentResponse;
  submitted_at: string;
  review: ReviewSummaryResponse;
}

interface ReviewerResponse {
  id: string;
  role: string;
}

interface SubmissionDocumentResponse {
  id: string;
  requirement_code: string;
  required: boolean;
  name: string;
  file_name: string;
  content_type: string;
  file_size: number;
  uploaded_at: string;
  status: string;
  verified_at?: string;
  rejection_reason?: string;
  reviewer?: ReviewerResponse | null;
}

interface QueueSummaryResponse {
  pending_review: number;
  verified: number;
  rejected: number;
  expired_pcc: number;
  near_expiry_pcc: number;
}

interface SubmissionDetailResponse extends QueueItemResponse {
  documents: SubmissionDocumentResponse[];
}

interface DocumentAccessResponse {
  document_id: string;
  url: string;
  expires_at: string;
}

interface ReviewDecisionResponse {
  document: SubmissionDocumentResponse;
  submission: {
    id: string;
    review: ReviewSummaryResponse;
  };
}

interface QueuePaginationResponse {
  page: number;
  per_page: number;
  total_count: number;
  total_pages: number;
}

export interface RealAdminDocumentReviewsClientOptions {
  apiClient: ApiClient;
  staffAuthClient: StaffAuthClient;
  /** Read fresh on every call so a language switch is reflected immediately -- the backend localizes country/project/craft/document-type names and messages per this header. */
  getLocale: () => 'en' | 'ur';
}

const KNOWN_REVIEW_STATES = new Set<string>(['pending_review', 'partially_reviewed', 'changes_required', 'verified']);
const KNOWN_DOCUMENT_STATUSES = new Set<string>(['uploaded', 'pending_review', 'verified', 'rejected']);
const KNOWN_REVIEWER_ROLES = new Set<string>(['admin', 'hr', 'mps', 'finance', 'management']);

function toReviewState(raw: unknown): ReviewDisplayState {
  return typeof raw === 'string' && KNOWN_REVIEW_STATES.has(raw) ? (raw as ReviewDisplayState) : 'unknown';
}

function toReviewerRole(raw: unknown): ReviewerDisplayRole {
  return typeof raw === 'string' && KNOWN_REVIEWER_ROLES.has(raw) ? (raw as ReviewerDisplayRole) : 'unknown';
}

/** No personal name or email is ever mapped here -- `role` (translated client-side) is the entire extent of "reviewer information" the backend contract provides. */
function toReviewerInfo(raw: unknown): ReviewerInfo | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as Partial<ReviewerResponse>;
  if (typeof value.id !== 'string' || !value.id) return undefined;

  return { id: value.id, role: toReviewerRole(value.role) };
}

function toDocumentStatus(raw: unknown): DocumentDisplayStatus {
  return typeof raw === 'string' && KNOWN_DOCUMENT_STATUSES.has(raw) ? (raw as DocumentDisplayStatus) : 'unknown';
}

function toNumber(raw: unknown): number {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
}

/**
 * A missing/malformed `name` maps to '' here, never to the raw `code` --
 * `code` is a business identifier (e.g. a project code), not display text,
 * and the ticket explicitly forbids ever showing a raw API code to a
 * reviewer (review finding: "Defensive mapping can display raw project/
 * country/craft codes"). The UI layer renders '' as a localized "Name
 * unavailable" fallback instead.
 */
function toReferenceCode(raw: unknown): ReferenceCode {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<ReferenceCodeResponse>;
  return {
    code: typeof value.code === 'string' ? value.code : '',
    name: typeof value.name === 'string' ? value.name : '',
  };
}

function toQueueCandidate(raw: unknown): QueueCandidate {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<QueueCandidateResponse>;
  return {
    id: typeof value.id === 'string' ? value.id : '',
    fullName: typeof value.full_name === 'string' ? value.full_name : '',
  };
}

function toQueueAssignment(raw: unknown): QueueAssignment {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<QueueAssignmentResponse>;
  return {
    id: typeof value.id === 'string' ? value.id : '',
    referenceNumber: typeof value.reference_number === 'string' ? value.reference_number : '',
    country: toReferenceCode(value.country),
    project: toReferenceCode(value.project),
    craft: toReferenceCode(value.craft),
  };
}

function toReviewSummary(raw: unknown): ReviewSummary {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<ReviewSummaryResponse>;
  return {
    pendingReview: toNumber(value.pending_review),
    verified: toNumber(value.verified),
    rejected: toNumber(value.rejected),
    requiredTotal: toNumber(value.required_total),
    reviewState: toReviewState(value.review_state),
  };
}

function toQueueItem(raw: unknown): DocumentReviewQueueItem {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<QueueItemResponse>;
  return {
    id: typeof value.id === 'string' ? value.id : '',
    candidate: toQueueCandidate(value.candidate),
    assignment: toQueueAssignment(value.assignment),
    submittedAt: typeof value.submitted_at === 'string' ? value.submitted_at : '',
    review: toReviewSummary(value.review),
  };
}

function toSubmissionDocument(raw: unknown): SubmissionDocument | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<SubmissionDocumentResponse>;
  if (typeof value.id !== 'string' || !value.id) return null;

  return {
    id: value.id,
    requirementCode: typeof value.requirement_code === 'string' ? value.requirement_code : '',
    required: value.required === true,
    name: typeof value.name === 'string' ? value.name : '',
    fileName: typeof value.file_name === 'string' ? value.file_name : '',
    contentType: typeof value.content_type === 'string' ? value.content_type : '',
    fileSize: toNumber(value.file_size),
    uploadedAt: typeof value.uploaded_at === 'string' ? value.uploaded_at : '',
    status: toDocumentStatus(value.status),
    verifiedAt: typeof value.verified_at === 'string' ? value.verified_at : undefined,
    rejectionReason: typeof value.rejection_reason === 'string' ? value.rejection_reason : undefined,
    reviewer: toReviewerInfo(value.reviewer),
  };
}

function toSubmissionDocuments(raw: unknown): SubmissionDocument[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(toSubmissionDocument).filter((item): item is SubmissionDocument => item !== null);
}

function toSubmissionDetail(raw: unknown): DocumentSubmissionDetail {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<SubmissionDetailResponse>;
  return {
    ...toQueueItem(value),
    documents: toSubmissionDocuments(value.documents),
  };
}

function toDocumentAccess(raw: unknown): DocumentAccess {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<DocumentAccessResponse>;
  return {
    documentId: typeof value.document_id === 'string' ? value.document_id : '',
    url: typeof value.url === 'string' ? value.url : '',
    expiresAt: typeof value.expires_at === 'string' ? value.expires_at : '',
  };
}

function toReviewDecisionResult(raw: unknown): ReviewDecisionResult {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<ReviewDecisionResponse>;
  const document = toSubmissionDocument(value.document);
  const submission = (value.submission ?? {}) as Partial<ReviewDecisionResponse['submission']>;

  return {
    // A malformed/missing document in a 2xx response would be a genuine
    // contract violation -- fall back to an empty, clearly-unknown document
    // rather than throwing, consistent with this module's never-crash
    // mapping convention elsewhere.
    document: document ?? {
      id: '',
      requirementCode: '',
      required: false,
      name: '',
      fileName: '',
      contentType: '',
      fileSize: 0,
      uploadedAt: '',
      status: 'unknown',
    },
    submission: {
      id: typeof submission.id === 'string' ? submission.id : '',
      review: toReviewSummary(submission.review),
    },
  };
}

function toQueueSummary(raw: unknown): DocumentReviewQueueSummary {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<QueueSummaryResponse>;
  return {
    pendingReview: toNumber(value.pending_review),
    verified: toNumber(value.verified),
    rejected: toNumber(value.rejected),
    expiredPcc: toNumber(value.expired_pcc),
    nearExpiryPcc: toNumber(value.near_expiry_pcc),
  };
}

function toPagination(raw: unknown): QueuePagination {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<QueuePaginationResponse>;
  return {
    page: toNumber(value.page) || 1,
    perPage: toNumber(value.per_page) || 0,
    totalCount: toNumber(value.total_count),
    totalPages: toNumber(value.total_pages),
  };
}

/** Maps the backend's ErrorItem.code to the shared error taxonomy (see the 14 error classes under descon-be's app/errors/). */
const SERVER_CODE_TO_ERROR: Record<string, AdminDocumentReviewErrorCode> = {
  missing_idempotency_key: 'MISSING_IDEMPOTENCY_KEY',
  invalid_idempotency_key: 'INVALID_IDEMPOTENCY_KEY',
  review_not_allowed: 'REVIEW_NOT_ALLOWED',
  document_submission_not_found: 'DOCUMENT_SUBMISSION_NOT_FOUND',
  candidate_document_not_found: 'CANDIDATE_DOCUMENT_NOT_FOUND',
  document_access_forbidden: 'DOCUMENT_ACCESS_FORBIDDEN',
  document_attachment_missing: 'DOCUMENT_ATTACHMENT_MISSING',
  document_not_pending_review: 'DOCUMENT_NOT_PENDING_REVIEW',
  document_already_reviewed: 'DOCUMENT_ALREADY_REVIEWED',
  rejection_reason_required: 'REJECTION_REASON_REQUIRED',
  rejection_reason_invalid: 'REJECTION_REASON_INVALID',
  idempotency_conflict: 'IDEMPOTENCY_CONFLICT',
  idempotency_in_progress: 'IDEMPOTENCY_IN_PROGRESS',
  inactive_account: 'INACTIVE_ACCOUNT',
  invalid_query_parameter: 'VALIDATION_ERROR',
};

/** A StaffAuthError (from authenticatedDataRequest's own 401 refresh-and-retry path) has no `status`; anything else here is the raw ApiError authenticatedDataRequest rethrew unchanged. */
function isStaffAuthError(error: unknown): error is StaffAuthError {
  return !!error && typeof error === 'object' && 'code' in error && !('status' in error);
}

function toReviewError(error: unknown): AdminDocumentReviewError {
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

  // A 403 needs its serverCode to distinguish an inactive account from a
  // permission/review-not-allowed failure -- both already handled above via
  // serverCode, so reaching here with a 403 means an unrecognized reason.
  if (apiError.status === 403) return { code: 'FORBIDDEN', message: apiError.message };
  if (apiError.status === 404) return { code: 'DOCUMENT_SUBMISSION_NOT_FOUND', message: apiError.message };
  if (apiError.status === 409) return { code: 'IDEMPOTENCY_CONFLICT', message: apiError.message };
  if (apiError.status === 422) return { code: 'VALIDATION_ERROR', message: apiError.message, field: apiError.field };
  if (apiError.status === 429) return { code: 'RATE_LIMITED', retryAfterSeconds: apiError.retryAfterSeconds };
  if (apiError.status >= 500) return { code: 'SERVER_ERROR' };

  return { code: 'UNKNOWN', message: apiError.message };
}

export function createAdminDocumentReviewsClient(
  options: RealAdminDocumentReviewsClientOptions
): AdminDocumentReviewsClient {
  const { apiClient, staffAuthClient, getLocale } = options;

  return {
    async getQueue(filters: DocumentReviewQueueFilters, page: DocumentReviewQueuePage): Promise<DocumentReviewQueueResult> {
      const query = buildDocumentReviewQueueQuery(filters, page);
      try {
        const result = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.getWithMeta<QueueItemResponse[]>(`/admin/document_submissions${query}`, {
            headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() },
          })
        );
        if (!result) throw { code: 'UNKNOWN' } satisfies AdminDocumentReviewError;

        const items = Array.isArray(result.data) ? result.data.map(toQueueItem) : [];
        const meta = result.meta as { pagination?: unknown; summary?: unknown } | undefined;
        const pagination = toPagination(meta?.pagination);
        const summary = toQueueSummary(meta?.summary);
        return { items, pagination, summary };
      } catch (error) {
        throw toReviewError(error);
      }
    },

    async getSubmission(submissionId: string): Promise<DocumentSubmissionDetail> {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.get<SubmissionDetailResponse>(`/admin/document_submissions/${encodeURIComponent(submissionId)}`, {
            headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() },
          })
        );
        return toSubmissionDetail(data);
      } catch (error) {
        throw toReviewError(error);
      }
    },

    async requestDocumentAccess(documentId: string): Promise<DocumentAccess> {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.post<DocumentAccessResponse>(`/admin/candidate_documents/${encodeURIComponent(documentId)}/access`, undefined, {
            headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() },
          })
        );
        return toDocumentAccess(data);
      } catch (error) {
        throw toReviewError(error);
      }
    },

    async verifyDocument(documentId: string, idempotencyKey: string): Promise<ReviewDecisionResult> {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.post<ReviewDecisionResponse>(
            `/admin/candidate_documents/${encodeURIComponent(documentId)}/verifications`,
            undefined,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'X-Locale': getLocale(),
                'Idempotency-Key': idempotencyKey,
              },
            }
          )
        );
        return toReviewDecisionResult(data);
      } catch (error) {
        throw toReviewError(error);
      }
    },

    async rejectDocument(documentId: string, reason: string, idempotencyKey: string): Promise<ReviewDecisionResult> {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.post<ReviewDecisionResponse>(
            `/admin/candidate_documents/${encodeURIComponent(documentId)}/rejections`,
            { rejection: { reason } },
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'X-Locale': getLocale(),
                'Idempotency-Key': idempotencyKey,
              },
            }
          )
        );
        return toReviewDecisionResult(data);
      } catch (error) {
        throw toReviewError(error);
      }
    },
  };
}

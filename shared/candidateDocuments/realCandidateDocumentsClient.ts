// Real CandidateDocumentsClient implementation, calling the backend
// documented in descon-be's openapi.yaml:
//   GET  /api/v1/candidate/documents
//   POST /api/v1/candidate/documents
import type { ApiClient, ApiError } from '../api-client';
import { toDocumentFiles, toSideCode } from './documentFiles';
import type {
  CandidateDocumentChecklistItem,
  CandidateDocumentContentType,
  CandidateDocumentDisplayStatus,
  CandidateDocumentMetadata,
  CandidateDocumentsClient,
  CandidateDocumentsError,
  CandidateDocumentsErrorCode,
  DocumentAccess,
  DocumentAccessDisposition,
  DocumentAccessError,
  DocumentAccessErrorCode,
  DocumentFileSetReason,
  DocumentSideCode,
  DocumentUploadRules,
  PccComplianceDisplayStatus,
  UploadDocumentParams,
} from './types';

interface CandidateDocumentMetadataResponse {
  id: string;
  file_name: string;
  content_type: string;
  file_size: number;
  files?: unknown[];
  uploaded_at: string;
  issued_on?: string | null;
  expires_on?: string | null;
  compliance_status?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
}

interface CandidateDocumentChecklistItemResponse {
  requirement_code: string;
  name: string;
  required: boolean;
  display_position?: number;
  instructions?: string | null;
  minimum_files?: number;
  maximum_files?: number;
  combined_pdf_allowed?: boolean;
  allowed_side_codes?: string[];
  accepted_content_types?: string[];
  maximum_file_size?: number;
  status: string;
  replacement_allowed: boolean;
  document: CandidateDocumentMetadataResponse | null;
}

interface DocumentAccessResponse {
  document_id: string;
  file_id?: string;
  url: string;
  expires_at: string;
}

export interface RealCandidateDocumentsClientOptions {
  apiClient: ApiClient;
  /** Read fresh on every call so a language switch is reflected immediately -- the backend localizes `name` and error messages per this header. */
  getLocale: () => 'en' | 'ur';
}

const KNOWN_STATUSES = new Set<string>(['missing', 'uploaded', 'pending_review', 'verified', 'rejected']);
const KNOWN_CONTENT_TYPES = new Set<string>(['application/pdf', 'image/jpeg', 'image/png']);
const KNOWN_COMPLIANCE_STATUSES = new Set<string>(['current', 'near_expiry', 'expired', 'not_applicable']);
const KNOWN_FILE_SET_REASONS = new Set<string>([
  'too_few_files',
  'too_many_files',
  'side_code_required',
  'side_code_not_allowed',
  'duplicate_side_code',
  'incomplete_side_pair',
  'combined_must_be_alone',
  'combined_requires_pdf',
]);
/** The backend's own per-file default, used only if a response omits the field. */
const DEFAULT_MAXIMUM_FILE_SIZE = 5 * 1024 * 1024;

function toStatus(raw: unknown): CandidateDocumentDisplayStatus {
  return typeof raw === 'string' && KNOWN_STATUSES.has(raw) ? (raw as CandidateDocumentDisplayStatus) : 'unknown';
}

function toComplianceStatus(raw: unknown): PccComplianceDisplayStatus | undefined {
  if (raw === null || raw === undefined) return undefined;
  return typeof raw === 'string' && KNOWN_COMPLIANCE_STATUSES.has(raw) ? (raw as PccComplianceDisplayStatus) : 'unknown';
}

function toContentType(raw: unknown): CandidateDocumentContentType {
  // A malformed/unrecognized content_type doesn't stop the file name/size/
  // date from rendering -- it only affects which icon (if any) a caller
  // chooses to show. Falling back to the PDF value here is an arbitrary,
  // harmless default, not a claim about the actual file.
  return typeof raw === 'string' && KNOWN_CONTENT_TYPES.has(raw) ? (raw as CandidateDocumentContentType) : 'application/pdf';
}

/** Humanizes a requirement code into a readable fallback ("next_of_kin_cnic" -> "Next Of Kin Cnic") -- used only when the backend's own localized `name` is missing/malformed, never to replace a real name. */
function humanizeRequirementCode(code: string): string {
  return code
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function toFiniteNumber(raw: unknown, fallback: number): number {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback;
}

/** Defaults stand for "one file of any accepted type" -- the backend validates the real rules regardless. */
function toUploadRules(value: Partial<CandidateDocumentChecklistItemResponse>): DocumentUploadRules {
  const minimumFiles = Math.max(1, toFiniteNumber(value.minimum_files, 1));
  const acceptedContentTypes = Array.isArray(value.accepted_content_types)
    ? value.accepted_content_types.filter((type): type is CandidateDocumentContentType => KNOWN_CONTENT_TYPES.has(type))
    : [];
  return {
    minimumFiles,
    maximumFiles: Math.max(minimumFiles, toFiniteNumber(value.maximum_files, minimumFiles)),
    combinedPdfAllowed: value.combined_pdf_allowed === true,
    allowedSideCodes: Array.isArray(value.allowed_side_codes)
      ? value.allowed_side_codes.map(toSideCode).filter((code): code is DocumentSideCode => code !== null)
      : [],
    acceptedContentTypes: acceptedContentTypes.length
      ? acceptedContentTypes
      : (['application/pdf', 'image/jpeg', 'image/png'] as CandidateDocumentContentType[]),
    maximumFileSize: toFiniteNumber(value.maximum_file_size, DEFAULT_MAXIMUM_FILE_SIZE),
  };
}

function toDocumentMetadata(raw: unknown): CandidateDocumentMetadata | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<CandidateDocumentMetadataResponse>;
  if (typeof value.id !== 'string' || !value.id) return null;

  return {
    id: value.id,
    fileName: typeof value.file_name === 'string' && value.file_name ? value.file_name : '',
    contentType: toContentType(value.content_type),
    fileSize: toFiniteNumber(value.file_size, 0),
    files: toDocumentFiles(value.files),
    uploadedAt: typeof value.uploaded_at === 'string' ? value.uploaded_at : '',
    issuedOn: typeof value.issued_on === 'string' ? value.issued_on : undefined,
    expiresOn: typeof value.expires_on === 'string' ? value.expires_on : undefined,
    complianceStatus: toComplianceStatus(value.compliance_status),
    reviewedAt: typeof value.reviewed_at === 'string' ? value.reviewed_at : undefined,
    rejectionReason: typeof value.rejection_reason === 'string' ? value.rejection_reason : undefined,
  };
}

/** Defensively maps one raw checklist item -- a malformed field falls back to a safe default rather than throwing, so one bad item never crashes the whole checklist (ticket: "Do not allow malformed responses to crash either application"). Returns null only when the item has no usable requirement_code to key it by. */
function toChecklistItem(raw: unknown): CandidateDocumentChecklistItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<CandidateDocumentChecklistItemResponse>;
  if (typeof value.requirement_code !== 'string' || !value.requirement_code) return null;

  const requirementCode = value.requirement_code;
  return {
    requirementCode,
    name: typeof value.name === 'string' && value.name ? value.name : humanizeRequirementCode(requirementCode),
    required: value.required === true,
    // Unknown positions sort last, in the order the API returned them.
    displayPosition: toFiniteNumber(value.display_position, Number.MAX_SAFE_INTEGER),
    instructions: typeof value.instructions === 'string' && value.instructions ? value.instructions : null,
    uploadRules: toUploadRules(value),
    status: toStatus(value.status),
    replacementAllowed: value.replacement_allowed === true,
    document: toDocumentMetadata(value.document),
  };
}

/** In backend `display_position` order (a stable sort, so ties keep the API's own order). */
function toChecklist(data: unknown): CandidateDocumentChecklistItem[] {
  if (!Array.isArray(data)) return [];
  return data
    .map(toChecklistItem)
    .filter((item): item is CandidateDocumentChecklistItem => item !== null)
    .sort((a, b) => a.displayPosition - b.displayPosition);
}

function toDocumentAccess(data: DocumentAccessResponse): DocumentAccess {
  return { documentId: data.document_id, fileId: data.file_id ?? '', url: data.url, expiresAt: data.expires_at };
}

function toFileSetReason(apiError: ApiError): DocumentFileSetReason | undefined {
  const reason = apiError.errors?.[0]?.details?.reason;
  return typeof reason === 'string' && KNOWN_FILE_SET_REASONS.has(reason) ? (reason as DocumentFileSetReason) : undefined;
}

/** Maps the backend's ErrorItem.code (see openapi.yaml's /candidate/documents/{document_id}/access 404/422 examples) to the document-access error taxonomy. */
const SERVER_CODE_TO_ACCESS_ERROR: Record<string, DocumentAccessErrorCode> = {
  inactive_account: 'INACTIVE_ACCOUNT',
  document_attachment_missing: 'DOCUMENT_ATTACHMENT_MISSING',
};

function toDocumentAccessError(error: unknown): DocumentAccessError {
  const apiError = error as ApiError;
  if (!apiError || typeof apiError !== 'object' || !('code' in apiError)) {
    return { code: 'UNKNOWN' };
  }

  if (apiError.code === 'OFFLINE') return { code: 'OFFLINE' };
  if (apiError.code === 'NETWORK_ERROR' || apiError.code === 'TIMEOUT') return { code: 'NETWORK_ERROR' };
  if (apiError.code === 'CANCELLED') return { code: 'UNKNOWN' };

  if (apiError.status === 401) return { code: 'SESSION_EXPIRED' };

  const mapped = apiError.serverCode ? SERVER_CODE_TO_ACCESS_ERROR[apiError.serverCode] : undefined;
  if (mapped) return { code: mapped, message: apiError.message };

  if (apiError.status === 403) return { code: 'INACTIVE_ACCOUNT' };
  if (apiError.status === 404) return { code: 'NOT_FOUND', message: apiError.message };
  if (apiError.status === 429) return { code: 'RATE_LIMITED', retryAfterSeconds: apiError.retryAfterSeconds };
  if (apiError.status >= 500) return { code: 'SERVER_ERROR' };

  return { code: 'UNKNOWN', message: apiError.message };
}

/** Maps the backend's ErrorItem.code (see openapi.yaml's /candidate/documents 422/409/403 examples) to the shared error taxonomy. */
const SERVER_CODE_TO_ERROR: Record<string, CandidateDocumentsErrorCode> = {
  inactive_account: 'INACTIVE_ACCOUNT',
  idempotency_conflict: 'CONFLICT',
  missing_file: 'MISSING_FILE',
  invalid_requirement: 'INVALID_REQUIREMENT',
  unsupported_file_type: 'UNSUPPORTED_FILE_TYPE',
  file_too_large: 'FILE_TOO_LARGE',
  empty_file: 'EMPTY_FILE',
  replacement_not_allowed: 'REPLACEMENT_NOT_ALLOWED',
  invalid_document_files: 'INVALID_DOCUMENT_FILES',
  malware_detected: 'MALWARE_DETECTED',
  malware_scan_unavailable: 'MALWARE_SCAN_UNAVAILABLE',
  // A candidate-entered PCC issue date that's missing/malformed/in the
  // future (validation_failed) or an attempt to supply expires_on, which
  // the backend always computes itself (pcc_expiry_not_editable) -- both
  // carry a specific, already-localized `message` for the actual problem.
  validation_failed: 'VALIDATION_ERROR',
  pcc_expiry_not_editable: 'VALIDATION_ERROR',
};

function toDocumentsError(error: unknown): CandidateDocumentsError {
  const apiError = error as ApiError;
  if (!apiError || typeof apiError !== 'object' || !('code' in apiError)) {
    return { code: 'UNKNOWN' };
  }

  if (apiError.code === 'OFFLINE') return { code: 'OFFLINE' };
  if (apiError.code === 'NETWORK_ERROR' || apiError.code === 'TIMEOUT') return { code: 'NETWORK_ERROR' };
  if (apiError.code === 'CANCELLED') return { code: 'UNKNOWN' };

  if (apiError.status === 401) return { code: 'SESSION_EXPIRED' };

  const mapped = apiError.serverCode ? SERVER_CODE_TO_ERROR[apiError.serverCode] : undefined;
  if (mapped === 'INVALID_DOCUMENT_FILES') {
    return { code: mapped, message: apiError.message, field: apiError.field, reason: toFileSetReason(apiError) };
  }
  if (mapped) return { code: mapped, message: apiError.message, field: apiError.field };

  if (apiError.status === 403) return { code: 'INACTIVE_ACCOUNT' };
  if (apiError.status === 409) return { code: 'CONFLICT', message: apiError.message };
  if (apiError.status === 429) return { code: 'RATE_LIMITED', retryAfterSeconds: apiError.retryAfterSeconds };
  if (apiError.status >= 500) return { code: 'SERVER_ERROR' };

  return { code: 'UNKNOWN', message: apiError.message };
}

export function createCandidateDocumentsClient(options: RealCandidateDocumentsClientOptions): CandidateDocumentsClient {
  const { apiClient, getLocale } = options;

  return {
    async getChecklist(accessToken: string): Promise<CandidateDocumentChecklistItem[]> {
      try {
        const data = await apiClient.get<CandidateDocumentChecklistItemResponse[]>('/candidate/documents', {
          headers: { Authorization: `Bearer ${accessToken}`, 'X-Locale': getLocale() },
        });
        return toChecklist(data);
      } catch (error) {
        throw toDocumentsError(error);
      }
    },

    async uploadDocument(params: UploadDocumentParams): Promise<CandidateDocumentChecklistItem> {
      const { accessToken, formData, idempotencyKey } = params;
      try {
        const data = await apiClient.post<CandidateDocumentChecklistItemResponse>('/candidate/documents', formData, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Locale': getLocale(),
            'Idempotency-Key': idempotencyKey,
          },
        });
        const item = data ? toChecklistItem(data) : null;
        if (!item) throw { code: 'UNKNOWN' } satisfies CandidateDocumentsError;
        return item;
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && !('status' in error)) {
          // Already a well-formed CandidateDocumentsError (thrown directly
          // above), not a fetch failure -- rethrow unchanged.
          throw error;
        }
        throw toDocumentsError(error);
      }
    },

    async requestDocumentAccess(
      accessToken: string,
      documentId: string,
      disposition?: DocumentAccessDisposition,
      fileId?: string
    ): Promise<DocumentAccess> {
      const body = { ...(disposition ? { disposition } : {}), ...(fileId ? { file_id: fileId } : {}) };
      try {
        const data = await apiClient.post<DocumentAccessResponse>(
          `/candidate/documents/${encodeURIComponent(documentId)}/access`,
          Object.keys(body).length ? body : undefined,
          { headers: { Authorization: `Bearer ${accessToken}`, 'X-Locale': getLocale() } }
        );
        if (!data) throw { code: 'UNKNOWN' } satisfies DocumentAccessError;
        return toDocumentAccess(data);
      } catch (error) {
        throw toDocumentAccessError(error);
      }
    },
  };
}

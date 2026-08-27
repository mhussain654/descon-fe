// Real CandidateDocumentsClient implementation, calling the backend
// documented in descon-be's openapi.yaml:
//   GET  /api/v1/candidate/documents
//   POST /api/v1/candidate/documents
import type { ApiClient, ApiError } from '../api-client';
import type {
  CandidateDocumentChecklistItem,
  CandidateDocumentContentType,
  CandidateDocumentDisplayStatus,
  CandidateDocumentMetadata,
  CandidateDocumentsClient,
  CandidateDocumentsError,
  CandidateDocumentsErrorCode,
  UploadDocumentParams,
} from './types';

interface CandidateDocumentMetadataResponse {
  id: string;
  file_name: string;
  content_type: string;
  file_size: number;
  uploaded_at: string;
}

interface CandidateDocumentChecklistItemResponse {
  requirement_code: string;
  name: string;
  required: boolean;
  status: string;
  replacement_allowed: boolean;
  document: CandidateDocumentMetadataResponse | null;
}

export interface RealCandidateDocumentsClientOptions {
  apiClient: ApiClient;
  /** Read fresh on every call so a language switch is reflected immediately -- the backend localizes `name` and error messages per this header. */
  getLocale: () => 'en' | 'ur';
}

const KNOWN_STATUSES = new Set<string>(['missing', 'uploaded', 'pending_review', 'verified', 'rejected']);
const KNOWN_CONTENT_TYPES = new Set<string>(['application/pdf', 'image/jpeg', 'image/png']);

function toStatus(raw: unknown): CandidateDocumentDisplayStatus {
  return typeof raw === 'string' && KNOWN_STATUSES.has(raw) ? (raw as CandidateDocumentDisplayStatus) : 'unknown';
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

function toDocumentMetadata(raw: unknown): CandidateDocumentMetadata | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<CandidateDocumentMetadataResponse>;
  if (typeof value.id !== 'string' || !value.id) return null;

  return {
    id: value.id,
    fileName: typeof value.file_name === 'string' && value.file_name ? value.file_name : '',
    contentType: toContentType(value.content_type),
    fileSize: typeof value.file_size === 'number' && Number.isFinite(value.file_size) ? value.file_size : 0,
    uploadedAt: typeof value.uploaded_at === 'string' ? value.uploaded_at : '',
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
    status: toStatus(value.status),
    replacementAllowed: value.replacement_allowed === true,
    document: toDocumentMetadata(value.document),
  };
}

function toChecklist(data: unknown): CandidateDocumentChecklistItem[] {
  if (!Array.isArray(data)) return [];
  return data.map(toChecklistItem).filter((item): item is CandidateDocumentChecklistItem => item !== null);
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
  if (mapped) return { code: mapped, message: apiError.message };

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
  };
}

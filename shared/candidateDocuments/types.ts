// Candidate document checklist/upload types (frontend ticket: "Candidate
// Document Checklist and Upload Flow"), shared by web and mobile, wired to
// the real backend documented in descon-be's openapi.yaml:
//   GET  /api/v1/candidate/documents
//   POST /api/v1/candidate/documents
//
// Platform-independent only: no browser `File` type and no React Native
// document-picker type appears anywhere in this module. `uploadDocument`
// takes an already-built `FormData` -- the platform-specific feature code
// appends its own file representation (a browser File on web, a
// `{ uri, name, type }`-shaped part on mobile) before calling in.

export type CandidateDocumentStatus = 'missing' | 'uploaded' | 'pending_review' | 'verified' | 'rejected';

/**
 * `'unknown'` is not a real backend value -- it's what an unrecognized
 * future status gets normalized to at the client boundary (see
 * realCandidateDocumentsClient.ts's `toStatus`), so the UI has a safe,
 * non-actionable state to render instead of crashing or showing a raw code
 * (ticket: "Treat unknown future statuses safely").
 */
export type CandidateDocumentDisplayStatus = CandidateDocumentStatus | 'unknown';

export type CandidateDocumentContentType = 'application/pdf' | 'image/jpeg' | 'image/png' | 'unknown';

/** Only present for the `police_character` (PCC) requirement -- see PccComplianceDisplayStatus for the 'unknown' fallback used for any value this build doesn't recognize. */
export type PccComplianceStatus = 'current' | 'near_expiry' | 'expired' | 'not_applicable';

export type PccComplianceDisplayStatus = PccComplianceStatus | 'unknown';

/**
 * Which part of a document a file is: one `combined` PDF holding every part,
 * `front`/`back` or `page_1`/`page_2` image parts, or one of several
 * `certificate` files. Which ones a requirement accepts comes from its
 * `uploadRules.allowedSideCodes` -- never decided on the client.
 */
export type DocumentSideCode = 'combined' | 'front' | 'back' | 'page_1' | 'page_2' | 'certificate';

/** One stored file of a (possibly multi-file) document. */
export interface CandidateDocumentFile {
  id: string;
  /** Null for a document that uses no part labels. */
  sideCode: DocumentSideCode | null;
  position: number;
  fileName: string;
  contentType: CandidateDocumentContentType;
  fileSize: number;
}

/** How a requirement's file set must be uploaded -- backend-decided per requirement (and country). */
export interface DocumentUploadRules {
  minimumFiles: number;
  maximumFiles: number;
  combinedPdfAllowed: boolean;
  /** Empty when the requirement uses no part labels (a single file). */
  allowedSideCodes: DocumentSideCode[];
  acceptedContentTypes: CandidateDocumentContentType[];
  /** Per-file limit, in bytes. */
  maximumFileSize: number;
}

export interface CandidateDocumentMetadata {
  id: string;
  /** Deprecated single-file fields describing the document's representative file -- prefer `files`. */
  fileName: string;
  contentType: CandidateDocumentContentType;
  fileSize: number;
  /** Every file of the document, in upload order. */
  files: CandidateDocumentFile[];
  /** ISO 8601 timestamp. */
  uploadedAt: string;
  /** Present only for the `police_character` requirement (ISO 8601 date). */
  issuedOn?: string;
  /** Present only for the `police_character` requirement -- calculated by the backend as exactly six calendar months after `issuedOn` (ISO 8601 date). */
  expiresOn?: string;
  /** Present only for the `police_character` requirement. */
  complianceStatus?: PccComplianceDisplayStatus;
  /** Present only once the document has been reviewed (verified or rejected). ISO 8601 timestamp. */
  reviewedAt?: string;
  /** Present only when this document's current status is 'rejected'. */
  rejectionReason?: string;
}

export interface CandidateDocumentChecklistItem {
  requirementCode: string;
  /** Already localized server-side per the request's X-Locale -- render directly, never substitute a hardcoded frontend name. */
  name: string;
  required: boolean;
  /** Backend display order -- the checklist is shown sorted by this, never by a client-side list. */
  displayPosition: number;
  /** Already localized server-side; null when the requirement has none. */
  instructions: string | null;
  uploadRules: DocumentUploadRules;
  status: CandidateDocumentDisplayStatus;
  replacementAllowed: boolean;
  /** Null until a document has been uploaded for this requirement. */
  document: CandidateDocumentMetadata | null;
}

export type CandidateDocumentsErrorCode =
  | 'SESSION_EXPIRED'
  /** 403 `inactive_account` -- ends the candidate session, never shown as a generic permission error. */
  | 'INACTIVE_ACCOUNT'
  /** 409 `idempotency_conflict` -- the same key was reused with different upload content, or an identical request is still processing. Never presented as success. */
  | 'CONFLICT'
  | 'MISSING_FILE'
  | 'INVALID_REQUIREMENT'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'EMPTY_FILE'
  /** 422 `replacement_not_allowed` -- the checklist must be refreshed, since the item's status (and therefore its replacement eligibility) may have changed since it was loaded. */
  | 'REPLACEMENT_NOT_ALLOWED'
  /** 422 `invalid_document_files` -- the file set breaks the requirement's rules; `reason` says how. */
  | 'INVALID_DOCUMENT_FILES'
  /** 422 `malware_detected` -- a file was rejected by malware scanning. */
  | 'MALWARE_DETECTED'
  /** 503 `malware_scan_unavailable` -- uploads are refused while no scanner is available (fail closed); try later. */
  | 'MALWARE_SCAN_UNAVAILABLE'
  /**
   * 422 `validation_failed` (a candidate-entered PCC issue date that's
   * missing, malformed, or in the future) or `pcc_expiry_not_editable` (the
   * client attempted to supply `expires_on`, which the backend always
   * computes itself). Both carry a backend-localized `message` specific to
   * the actual problem, and a `field` identifying which form field it
   * applies to -- always prefer the message over this generic code.
   */
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

/** Why a file set was rejected (`invalid_document_files`), as reported by the backend. */
export type DocumentFileSetReason =
  | 'too_few_files'
  | 'too_many_files'
  | 'side_code_required'
  | 'side_code_not_allowed'
  | 'duplicate_side_code'
  | 'incomplete_side_pair'
  | 'combined_must_be_alone'
  | 'combined_requires_pdf';

export interface CandidateDocumentsError {
  code: CandidateDocumentsErrorCode;
  /** Present for INVALID_DOCUMENT_FILES when the backend reported a known reason. */
  reason?: DocumentFileSetReason;
  /** Already-localized server message, when the backend provided one (every 422 code does). */
  message?: string;
  /** The request field this error applies to (e.g. 'candidate_document.issued_on'), when the backend supplied one -- present for VALIDATION_ERROR. */
  field?: string;
  retryAfterSeconds?: number;
}

export interface UploadDocumentParams {
  accessToken: string;
  requirementCode: string;
  /** Pre-built by platform code: a browser File appended on web, a `{ uri, name, type }` part appended on mobile. This module never inspects its contents. */
  formData: FormData;
  idempotencyKey: string;
}

/** `inline` opens the document for viewing; `attachment` prompts the device/browser to download and save it. */
export type DocumentAccessDisposition = 'inline' | 'attachment';

export interface DocumentAccess {
  documentId: string;
  /** The file this access serves (the requested one, or the document's representative file). */
  fileId: string;
  /** A relative, Rails-internal path (`only_path: true`) -- resolve against the API origin, not the full base URL, before using it (see resolveDocumentAccessUrl.ts). */
  url: string;
  /** ISO 8601. */
  expiresAt: string;
}

export type DocumentAccessErrorCode =
  /** 404 -- the document id doesn't exist, isn't owned by this candidate, or has been superseded by a newer version. */
  | 'NOT_FOUND'
  /** 422 `document_attachment_missing` -- the document record exists but its file attachment is unavailable. */
  | 'DOCUMENT_ATTACHMENT_MISSING'
  | 'INACTIVE_ACCOUNT'
  | 'SESSION_EXPIRED'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface DocumentAccessError {
  code: DocumentAccessErrorCode;
  message?: string;
  retryAfterSeconds?: number;
}

export interface CandidateDocumentsClient {
  /** The candidate's own session access token -- the only thing that determines whose checklist comes back; there is no id parameter to tamper with. */
  getChecklist(accessToken: string): Promise<CandidateDocumentChecklistItem[]>;
  uploadDocument(params: UploadDocumentParams): Promise<CandidateDocumentChecklistItem>;
  /** Requests a short-lived signed URL for one file of the candidate's own already-uploaded document (`fileId`, or its representative file when omitted), so they can view/download it at any time. `disposition` defaults to 'inline' server-side when omitted. */
  requestDocumentAccess(
    accessToken: string,
    documentId: string,
    disposition?: DocumentAccessDisposition,
    fileId?: string
  ): Promise<DocumentAccess>;
}

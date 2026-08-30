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

export type CandidateDocumentContentType = 'application/pdf' | 'image/jpeg' | 'image/png';

/** Only present for the `police_character` (PCC) requirement -- see PccComplianceDisplayStatus for the 'unknown' fallback used for any value this build doesn't recognize. */
export type PccComplianceStatus = 'current' | 'near_expiry' | 'expired' | 'not_applicable';

export type PccComplianceDisplayStatus = PccComplianceStatus | 'unknown';

export interface CandidateDocumentMetadata {
  id: string;
  fileName: string;
  contentType: CandidateDocumentContentType;
  fileSize: number;
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

export interface CandidateDocumentsError {
  code: CandidateDocumentsErrorCode;
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

export interface CandidateDocumentsClient {
  /** The candidate's own session access token -- the only thing that determines whose checklist comes back; there is no id parameter to tamper with. */
  getChecklist(accessToken: string): Promise<CandidateDocumentChecklistItem[]>;
  uploadDocument(params: UploadDocumentParams): Promise<CandidateDocumentChecklistItem>;
}

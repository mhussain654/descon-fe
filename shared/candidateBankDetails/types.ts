// Candidate bank details types (MPS-406/MPS-F401), wired to the real
// backend documented in descon-be's openapi.yaml:
//   GET /api/v1/candidate/bank_details
//   PUT /api/v1/candidate/bank_details
//
// A dedicated, structured resource -- account title/number/bank name plus
// a mandatory proof upload -- distinct from the generic per-requirement
// document checklist (shared/candidateDocuments/types.ts). The two generic
// 'bank_details'/'cheque_image' document-checklist entries this replaced
// are retired server-side (db/migrate/20260904090000_retire_generic_bank_
// document_requirements.rb): candidates now submit bank information only
// through this resource.

export type CandidateBankDetailState = 'missing' | 'submitted';

export interface CandidateBankDetailProof {
  fileName: string;
  contentType: string;
  fileSize: number;
  uploadedAt: string;
}

/** `accountNumber` is always masked server-side (Candidates::BankDetails::AccountNumberMasker) -- never the full value. */
export interface CandidateBankDetail {
  id: string;
  status: CandidateBankDetailState;
  accountTitle: string;
  accountNumber: string;
  bankName: string;
  proof: CandidateBankDetailProof;
  submittedAt: string;
  updatedAt: string;
}

export interface CandidateBankDetailSummary {
  status: CandidateBankDetailState;
  bankDetail: CandidateBankDetail | null;
}

export interface BankDetailUpsertParams {
  accessToken: string;
  /**
   * Pre-built by platform-specific code -- web builds it from a real
   * `File`, mobile from an expo-document-picker/image-picker asset's
   * `{ uri, name, type }` shape. The client never constructs this itself,
   * matching CandidateDocumentsClient.uploadDocument's identical,
   * already-proven platform-agnostic convention (see
   * shared/candidateDocuments/types.ts's UploadDocumentParams).
   */
  formData: FormData;
  idempotencyKey?: string;
}

export type CandidateBankDetailsErrorCode =
  | 'NO_CURRENT_ASSIGNMENT'
  | 'MISSING_ACCOUNT_TITLE'
  | 'MISSING_ACCOUNT_NUMBER'
  | 'INVALID_ACCOUNT_NUMBER'
  | 'MISSING_BANK_NAME'
  | 'MISSING_PROOF'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'EMPTY_FILE'
  | 'FILE_TOO_LARGE'
  /** 409 -- an identical idempotent request is already processing, or was reused for a different payload. */
  | 'CONFLICT'
  | 'FORBIDDEN'
  | 'INACTIVE_ACCOUNT'
  | 'SESSION_EXPIRED'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface CandidateBankDetailsError {
  code: CandidateBankDetailsErrorCode;
  /** Already-localized server message, when the backend provided one. */
  message?: string;
  field?: string;
  retryAfterSeconds?: number;
}

export interface CandidateBankDetailsClient {
  getBankDetail(accessToken: string): Promise<CandidateBankDetailSummary>;
  submitBankDetail(params: BankDetailUpsertParams): Promise<CandidateBankDetailSummary>;
}

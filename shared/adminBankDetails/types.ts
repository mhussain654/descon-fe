// Contract for staff reviewing a candidate's bank details, mirroring descon-be's openapi.yaml:
//   GET  /api/v1/admin/candidates/{candidate_id}/bank_details
//   POST /api/v1/admin/candidates/{candidate_id}/bank_details/proof_access
//   POST /api/v1/admin/candidates/{candidate_id}/bank_details/verification
//   POST /api/v1/admin/candidates/{candidate_id}/bank_details/rejection

export type AdminBankDetailStatus = 'submitted' | 'verified' | 'rejected';

export interface AdminBankDetail {
  id: string;
  status: AdminBankDetailStatus;
  accountTitle: string;
  /** Full for staff who manage payments, masked for everyone else. */
  accountNumber: string;
  bankName: string;
  proof: { fileName: string; contentType: string; fileSize: number };
  submittedAt: string;
  rejectionReason?: string;
  reviewedAt?: string;
  reviewedBy?: { id: string; role: string };
}

export interface AdminBankProofAccess {
  /** A short-lived, relative path to the proof file. */
  url: string;
  expiresAt: string;
}

export type AdminBankDetailErrorCode =
  | 'VALIDATION_FAILED'
  | 'ALREADY_REVIEWED'
  | 'FORBIDDEN'
  | 'INACTIVE_ACCOUNT'
  | 'SESSION_EXPIRED'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface AdminBankDetailError {
  code: AdminBankDetailErrorCode;
  message?: string;
  field?: string;
}

export interface AdminBankDetailsClient {
  /** The candidate's current bank details, or null when they have not added any. */
  get(candidateId: string): Promise<AdminBankDetail | null>;
  requestProofAccess(candidateId: string): Promise<AdminBankProofAccess>;
  verify(candidateId: string, idempotencyKey: string): Promise<AdminBankDetail>;
  reject(candidateId: string, reason: string, idempotencyKey: string): Promise<AdminBankDetail>;
}

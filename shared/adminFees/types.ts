export interface AdminFee {
  defaultAmount: string;
  overrideAmount: string | null;
  effectiveAmount: string;
  currencyCode: string;
  version: number;
  assignmentId: string | null;
  locked: boolean;
  updatedAt: string;
}
export interface FeeUpdate {
  amount: string | null;
  expectedVersion: number;
  reason: string;
}
export interface AdminFeeError {
  code:
    | "SESSION_EXPIRED"
    | "INACTIVE_ACCOUNT"
    | "FORBIDDEN"
    | "OFFLINE"
    | "NETWORK_ERROR"
    | "NOT_FOUND"
    | "STALE_FEE"
    | "FEE_LOCKED"
    | "VALIDATION_FAILED"
    | "SERVER_ERROR"
    | "UNKNOWN";
  message?: string;
  field?: string;
}
export interface AdminFeesClient {
  getFee(candidateId?: string): Promise<AdminFee>;
  updateFee(input: FeeUpdate, candidateId?: string): Promise<AdminFee>;
}
export function validFeeAmount(value: string): boolean {
  return /^\d{1,8}(?:\.\d{1,2})?$/.test(value) && Number(value) > 0;
}

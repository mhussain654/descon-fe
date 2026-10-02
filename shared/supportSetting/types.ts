// Candidate support-number types, wired to the real backend documented in
// descon-be's openapi.yaml:
//   GET /api/v1/candidate/support_setting
//
// Not per-candidate content -- one shared helpline number (managed by admin,
// see shared/adminSupportSetting/types.ts) that "Help & support" dials. Null
// until staff configure it, in which case the action is unavailable.

export interface SupportSetting {
  phoneNumber: string | null;
}

export type SupportSettingErrorCode =
  | 'FORBIDDEN'
  | 'INACTIVE_ACCOUNT'
  | 'SESSION_EXPIRED'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface SupportSettingError {
  code: SupportSettingErrorCode;
  message?: string;
  retryAfterSeconds?: number;
}

export interface SupportSettingClient {
  getSupportSetting(accessToken: string): Promise<SupportSetting>;
}

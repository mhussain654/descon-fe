// Admin support-number setting types (mirrors shared/adminTrainingSetting/types.ts), wired to the real backend documented
// in descon-be's openapi.yaml:
//   GET   /api/v1/admin/support_setting
//   PATCH /api/v1/admin/support_setting
//
// Singleton show+update only -- there is no create/destroy route, the row
// is seeded on migrate and lazily created on first access otherwise.
//
// Web-only (AGENTS.md: "administrative workflows remain web-focused").

export interface SupportSettingActorRef {
  id: string;
  role: string;
}

export interface AdminSupportSetting {
  /** Null until staff set a number -- candidates' "Help & support" stays unavailable meanwhile. */
  phoneNumber: string | null;
  updatedBy?: SupportSettingActorRef;
  updatedAt: string;
}

export interface AdminSupportSettingUpdateInput {
  /** Blank clears the number. */
  phoneNumber: string;
}

export type AdminSupportSettingErrorCode =
  | 'VALIDATION_FAILED'
  | 'FORBIDDEN'
  | 'INACTIVE_ACCOUNT'
  | 'SESSION_EXPIRED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface AdminSupportSettingError {
  code: AdminSupportSettingErrorCode;
  /** Already-localized server message, when the backend provided one. */
  message?: string;
  field?: string;
}

export interface AdminSupportSettingClient {
  getSupportSetting(): Promise<AdminSupportSetting>;
  updateSupportSetting(input: AdminSupportSettingUpdateInput): Promise<AdminSupportSetting>;
}

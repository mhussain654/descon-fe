// Admin App Settings feature switches, wired to the real backend documented in
// descon-be's openapi.yaml:
//   GET   /api/v1/admin/app_feature_setting
//   PATCH /api/v1/admin/app_feature_setting
//
// Singleton show+update only. A feature runs only when its switch is on AND
// the server is set up for it (`serverReady`), so the page can explain why a
// switch that is on still does nothing.
//
// Web-only (AGENTS.md: "administrative workflows remain web-focused").

export type AppFeatureSwitch =
  | 'cardPayment'
  | 'voucherPayment'
  | 'progressSms'
  | 'automaticCalls'
  | 'bulkCalls'
  | 'documentOcr';

export const APP_FEATURE_SWITCHES: readonly AppFeatureSwitch[] = [
  'cardPayment',
  'voucherPayment',
  'progressSms',
  'automaticCalls',
  'bulkCalls',
  'documentOcr',
];

export interface AppSettingsActorRef {
  id: string;
  role: string;
}

export interface AppSmsMessageSetting {
  /** Backend message code, e.g. `registered`, `fee_pending`. */
  code: string;
  enabled: boolean;
  /** Its send.pk template id is set on the server. */
  templateReady: boolean;
}

export interface AdminAppSettings {
  enabled: Record<AppFeatureSwitch, boolean>;
  serverReady: Record<AppFeatureSwitch, boolean>;
  smsMessages: AppSmsMessageSetting[];
  updatedBy?: AppSettingsActorRef;
  updatedAt: string;
}

export interface AdminAppSettingsUpdateInput {
  enabled: Partial<Record<AppFeatureSwitch, boolean>>;
  /** Message codes switched off; omit to leave them unchanged. */
  disabledSmsMessages?: string[];
}

export type AdminAppSettingsErrorCode =
  | 'VALIDATION_FAILED'
  | 'FORBIDDEN'
  | 'INACTIVE_ACCOUNT'
  | 'SESSION_EXPIRED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface AdminAppSettingsError {
  code: AdminAppSettingsErrorCode;
  /** Already-localized server message, when the backend provided one. */
  message?: string;
  field?: string;
}

export interface AdminAppSettingsClient {
  getAppSettings(): Promise<AdminAppSettings>;
  updateAppSettings(input: AdminAppSettingsUpdateInput): Promise<AdminAppSettings>;
}

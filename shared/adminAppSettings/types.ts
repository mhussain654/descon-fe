// Admin App Settings feature switches and SMS messages, wired to the real
// backend documented in descon-be's openapi.yaml:
//   GET   /api/v1/admin/app_feature_setting
//   PATCH /api/v1/admin/app_feature_setting
//   GET   /api/v1/admin/sms_templates
//   PATCH /api/v1/admin/sms_templates/{message_code}
//
// The feature switches are a singleton. A feature runs only when its switch is
// on AND the server is set up for it (`serverReady`), so the page can explain
// why a switch that is on still does nothing. Each SMS message (the OTP and
// every progress SMS) has its own send.pk template ids and on/off switch.
//
// Web-only (AGENTS.md: "administrative workflows remain web-focused").

export type AppFeatureSwitch =
  | 'cardPayment'
  | 'voucherPayment'
  | 'progressSms'
  | 'automaticCalls'
  | 'bulkCalls'
  | 'documentOcr'
  | 'documentIdentityCheck';

export const APP_FEATURE_SWITCHES: readonly AppFeatureSwitch[] = [
  'cardPayment',
  'voucherPayment',
  'progressSms',
  'automaticCalls',
  'bulkCalls',
  'documentOcr',
  'documentIdentityCheck',
];

export interface AppSettingsActorRef {
  id: string;
  role: string;
}

/** Allowed ranges for the KuickPay voucher dates (the backend enforces the same). */
export const VOUCHER_DUE_DAYS_RANGE = { min: 1, max: 60 } as const;
export const VOUCHER_GRACE_DAYS_RANGE = { min: 0, max: 15 } as const;

export interface AdminAppSettings {
  enabled: Record<AppFeatureSwitch, boolean>;
  serverReady: Record<AppFeatureSwitch, boolean>;
  /** KuickPay voucher due date = issue date + these days. */
  voucherDueDays: number;
  /** Expiry (last payable day) = due date + these days; no late fee. */
  voucherGraceDays: number;
  updatedBy?: AppSettingsActorRef;
  updatedAt: string;
}

export interface AdminAppSettingsUpdateInput {
  enabled: Partial<Record<AppFeatureSwitch, boolean>>;
  voucherDueDays?: number;
  voucherGraceDays?: number;
}

export interface SmsTemplate {
  /** Backend message code, e.g. `otp`, `fee_pending`. */
  messageCode: string;
  /** send.pk template ids; null when not set (a message with no English id is not sent). */
  templateIdEn: string | null;
  templateIdUr: string | null;
  enabled: boolean;
  /** False for the OTP: switching it off would stop candidates logging in. */
  canDisable: boolean;
  /** The values the message sends, which its send.pk template must use. */
  variables: string[];
  updatedBy?: AppSettingsActorRef;
  updatedAt: string;
}

export interface SmsTemplateUpdateInput {
  templateIdEn?: string;
  templateIdUr?: string;
  enabled?: boolean;
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
  listSmsTemplates(): Promise<SmsTemplate[]>;
  updateSmsTemplate(messageCode: string, input: SmsTemplateUpdateInput): Promise<SmsTemplate>;
}

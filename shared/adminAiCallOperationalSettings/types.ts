// Admin AI call operational settings (rate limits) types (MPS-712/MPS-F706),
// wired to the real backend documented in descon-be's openapi.yaml:
//   GET   /api/v1/admin/ai_call_operational_settings
//   PATCH /api/v1/admin/ai_call_operational_settings
//
// Singleton show+update only -- there is no create/destroy route, the row
// is seeded on migrate and lazily created on first access otherwise. A
// null field means that knob still falls back to AiCalls::Configuration's
// ENV var/default.
//
// Web-only (AGENTS.md: "administrative workflows remain web-focused").

export interface AiCallOperationalSettingActorRef {
  id: string;
  role: string;
}

export interface AiCallOperationalSetting {
  outboundTriggerCooldownMinutes: number | null;
  dailyOutboundCallLimit: number | null;
  adminTriggerRateLimitPerHour: number | null;
  callingHoursStart: number | null;
  callingHoursEnd: number | null;
  maxCallDurationMinutes: number | null;
  updatedBy?: AiCallOperationalSettingActorRef;
  updatedAt: string;
}

/** Every field nullable -- omitting one from a PATCH leaves it unchanged server-side, but this client's `updateAiCallOperationalSettings` always sends the full current form, so `null` here means "clear this override, fall back to ENV" rather than "leave unchanged." */
export interface AiCallOperationalSettingUpdateInput {
  outboundTriggerCooldownMinutes: number | null;
  dailyOutboundCallLimit: number | null;
  adminTriggerRateLimitPerHour: number | null;
  callingHoursStart: number | null;
  callingHoursEnd: number | null;
  maxCallDurationMinutes: number | null;
}

export type AiCallOperationalSettingErrorCode =
  | 'VALIDATION_FAILED'
  | 'FORBIDDEN'
  | 'INACTIVE_ACCOUNT'
  | 'SESSION_EXPIRED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface AiCallOperationalSettingError {
  code: AiCallOperationalSettingErrorCode;
  /** Already-localized server message, when the backend provided one. */
  message?: string;
  field?: string;
}

export interface AdminAiCallOperationalSettingsClient {
  getAiCallOperationalSettings(): Promise<AiCallOperationalSetting>;
  updateAiCallOperationalSettings(input: AiCallOperationalSettingUpdateInput): Promise<AiCallOperationalSetting>;
}

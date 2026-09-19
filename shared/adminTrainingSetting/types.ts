// Admin training-link setting types, wired to the real backend documented
// in descon-be's openapi.yaml:
//   GET   /api/v1/admin/training_setting
//   PATCH /api/v1/admin/training_setting
//
// Singleton show+update only -- there is no create/destroy route, the row
// is seeded on migrate and lazily created on first access otherwise.
//
// Web-only (AGENTS.md: "administrative workflows remain web-focused").

export interface TrainingSettingActorRef {
  id: string;
  role: string;
}

export interface AdminTrainingSetting {
  url: string;
  updatedBy?: TrainingSettingActorRef;
  updatedAt: string;
}

export interface AdminTrainingSettingUpdateInput {
  url: string;
}

export type AdminTrainingSettingErrorCode =
  | 'VALIDATION_FAILED'
  | 'FORBIDDEN'
  | 'INACTIVE_ACCOUNT'
  | 'SESSION_EXPIRED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface AdminTrainingSettingError {
  code: AdminTrainingSettingErrorCode;
  /** Already-localized server message, when the backend provided one. */
  message?: string;
  field?: string;
}

export interface AdminTrainingSettingClient {
  getTrainingSetting(): Promise<AdminTrainingSetting>;
  updateTrainingSetting(input: AdminTrainingSettingUpdateInput): Promise<AdminTrainingSetting>;
}

// Candidate training-link types, wired to the real backend documented in
// descon-be's openapi.yaml:
//   GET /api/v1/candidate/training_setting
//
// Not per-candidate content -- one shared link (managed by admin, see
// shared/adminTrainingSetting/types.ts) that every candidate is sent to for
// all training documents and videos, which live entirely off-platform.

export interface TrainingSetting {
  url: string;
}

export type TrainingSettingErrorCode =
  | 'FORBIDDEN'
  | 'INACTIVE_ACCOUNT'
  | 'SESSION_EXPIRED'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface TrainingSettingError {
  code: TrainingSettingErrorCode;
  message?: string;
  retryAfterSeconds?: number;
}

export interface TrainingSettingClient {
  getTrainingSetting(accessToken: string): Promise<TrainingSetting>;
}

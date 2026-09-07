// Admin database-backup browsing types (MPS-903), wired to the real backend
// documented in descon-be's openapi.yaml:
//   GET  /api/v1/admin/system_database_backups
//   POST /api/v1/admin/system_database_backups/:id/access
//
// Read-only list + a separate, audited access endpoint -- there is no show,
// create, update, or destroy route: a backup's outcome is written only by
// the owning job, never through the API. Admin-only (not even
// mps/management): backups are infra-sensitive.
//
// Web-only (AGENTS.md: "administrative workflows remain web-focused").

export type SystemBackupStatus = 'in_progress' | 'succeeded' | 'failed';

export interface SystemBackup {
  id: string;
  status: SystemBackupStatus;
  /** ISO 8601 timestamp. */
  takenAt: string;
  byteSize: number | null;
  checksumSha256: string | null;
  durationSeconds: number | null;
  errorMessage: string | null;
}

export interface SystemBackupListPage {
  number?: number;
  size?: number;
}

export interface SystemBackupListPagination {
  page: number;
  perPage: number;
  totalCount: number;
  totalPages: number;
}

export interface SystemBackupListResult {
  items: SystemBackup[];
  pagination: SystemBackupListPagination;
}

export interface SystemBackupAccess {
  backupId: string;
  url: string;
  /** ISO 8601 timestamp. */
  expiresAt: string;
}

export type SystemBackupErrorCode =
  /** 422 -- the backup has no attached archive (e.g. a failed attempt). */
  | 'ARCHIVE_NOT_FOUND'
  | 'FORBIDDEN'
  | 'INACTIVE_ACCOUNT'
  | 'SESSION_EXPIRED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface SystemBackupError {
  code: SystemBackupErrorCode;
  message?: string;
}

export interface AdminSystemBackupsClient {
  listBackups(page: SystemBackupListPage): Promise<SystemBackupListResult>;
  requestAccess(backupId: string): Promise<SystemBackupAccess>;
}

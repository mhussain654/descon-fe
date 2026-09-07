// Real AdminSystemBackupsClient implementation (MPS-903), calling the
// backend documented in descon-be's openapi.yaml:
//   GET  /api/v1/admin/system_database_backups
//   POST /api/v1/admin/system_database_backups/:id/access
import type { ApiClient, ApiError } from '../api-client';
import type { StaffAuthClient, StaffAuthError } from '../auth/staffTypes';
import type {
  AdminSystemBackupsClient,
  SystemBackup,
  SystemBackupAccess,
  SystemBackupError,
  SystemBackupErrorCode,
  SystemBackupListPage,
  SystemBackupListResult,
} from './types';

interface SystemBackupResponse {
  id: string;
  status: 'in_progress' | 'succeeded' | 'failed';
  taken_at: string;
  byte_size: number | null;
  checksum_sha256: string | null;
  duration_seconds: number | null;
  error_message: string | null;
}

interface SystemBackupAccessResponse {
  backup_id: string;
  url: string;
  expires_at: string;
}

export interface RealAdminSystemBackupsClientOptions {
  apiClient: ApiClient;
  staffAuthClient: StaffAuthClient;
  /** Read fresh on every call, matching every other real staff client in this repo. */
  getLocale: () => 'en' | 'ur';
}

function toBackup(data: SystemBackupResponse): SystemBackup {
  return {
    id: data.id,
    status: data.status,
    takenAt: data.taken_at,
    byteSize: data.byte_size,
    checksumSha256: data.checksum_sha256,
    durationSeconds: data.duration_seconds,
    errorMessage: data.error_message,
  };
}

function toPagination(raw: unknown): SystemBackupListResult['pagination'] {
  const value = (raw && typeof raw === 'object' ? raw : {}) as {
    page?: number;
    per_page?: number;
    total_count?: number;
    total_pages?: number;
  };
  return {
    page: typeof value.page === 'number' ? value.page : 1,
    perPage: typeof value.per_page === 'number' ? value.per_page : 0,
    totalCount: typeof value.total_count === 'number' ? value.total_count : 0,
    totalPages: typeof value.total_pages === 'number' ? value.total_pages : 0,
  };
}

function isStaffAuthError(error: unknown): error is StaffAuthError {
  return !!error && typeof error === 'object' && 'code' in error && !('status' in error);
}

function toSystemBackupError(error: unknown): SystemBackupError {
  if (isStaffAuthError(error)) {
    if (error.code === 'SESSION_EXPIRED') return { code: 'SESSION_EXPIRED' };
    if (error.code === 'NETWORK_ERROR') return { code: 'NETWORK_ERROR' };
    if (error.code === 'OFFLINE') return { code: 'OFFLINE' };
    return { code: 'UNKNOWN' };
  }

  const apiError = error as ApiError;
  if (!apiError || typeof apiError !== 'object' || !('code' in apiError)) {
    return { code: 'UNKNOWN' };
  }

  if (apiError.code === 'OFFLINE') return { code: 'OFFLINE' };
  if (apiError.code === 'NETWORK_ERROR' || apiError.code === 'TIMEOUT') return { code: 'NETWORK_ERROR' };
  if (apiError.code === 'CANCELLED') return { code: 'UNKNOWN' };

  return toSystemBackupErrorFromStatus(apiError);
}

function toSystemBackupErrorFromStatus(apiError: ApiError): SystemBackupError {
  if (apiError.status === 403) {
    const code: SystemBackupErrorCode = apiError.serverCode === 'inactive_account' ? 'INACTIVE_ACCOUNT' : 'FORBIDDEN';
    return { code, message: apiError.message };
  }
  if (apiError.status === 422 && apiError.serverCode === 'backup_archive_not_found') {
    return { code: 'ARCHIVE_NOT_FOUND', message: apiError.message };
  }
  if (apiError.status >= 500) return { code: 'SERVER_ERROR' };

  return { code: 'UNKNOWN', message: apiError.message };
}

export function createAdminSystemBackupsClient(options: RealAdminSystemBackupsClientOptions): AdminSystemBackupsClient {
  const { apiClient, staffAuthClient, getLocale } = options;

  return {
    async listBackups(page: SystemBackupListPage): Promise<SystemBackupListResult> {
      const query = new URLSearchParams();
      if (page.number) query.set('page[number]', String(page.number));
      if (page.size) query.set('page[size]', String(page.size));
      const suffix = query.toString() ? `?${query.toString()}` : '';

      try {
        const result = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.getWithMeta<SystemBackupResponse[]>(`/admin/system_database_backups${suffix}`, {
            headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() },
          })
        );
        if (!result) throw { code: 'UNKNOWN' } satisfies SystemBackupError;

        const items = Array.isArray(result.data) ? result.data.map(toBackup) : [];
        const meta = result.meta as { pagination?: unknown } | undefined;
        return { items, pagination: toPagination(meta?.pagination) };
      } catch (error) {
        throw toSystemBackupError(error);
      }
    },

    async requestAccess(backupId: string): Promise<SystemBackupAccess> {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.post<SystemBackupAccessResponse>(
            `/admin/system_database_backups/${encodeURIComponent(backupId)}/access`,
            {},
            { headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() } }
          )
        );
        if (!data) throw { code: 'UNKNOWN' } satisfies SystemBackupError;
        return { backupId: data.backup_id, url: data.url, expiresAt: data.expires_at };
      } catch (error) {
        throw toSystemBackupError(error);
      }
    },
  };
}

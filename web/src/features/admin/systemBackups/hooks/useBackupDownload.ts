import { useMutation } from '@tanstack/react-query';
import { adminSystemBackupsClient } from '../../../../lib/admin-system-backups-client';
import { resolveDocumentAccessUrl } from '../../../../lib/resolveDocumentAccessUrl';

/**
 * Requests a short-lived signed download URL for one backup and opens it
 * immediately in a new tab -- a one-shot action, unlike
 * useShortLivedAccess.ts's persistently-displayed-until-expiry credential
 * (a visa copy or flight ticket link stays on screen for the staff member
 * to click later; a backup download is used the instant it's issued, so
 * there's nothing to keep around or expire against).
 */
export function useBackupDownload() {
  const mutation = useMutation({
    mutationFn: (backupId: string) => adminSystemBackupsClient.requestAccess(backupId),
    onSuccess: (access) => {
      const url = resolveDocumentAccessUrl(access.url, import.meta.env.VITE_API_BASE_URL ?? '');
      window.open(url, '_blank', 'noopener,noreferrer');
    },
  });

  return { downloadBackup: mutation.mutate, ...mutation };
}

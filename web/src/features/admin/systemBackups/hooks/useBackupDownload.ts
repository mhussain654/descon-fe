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
 *
 * The tab is opened synchronously, inside the click handler, *before* the
 * async access request -- opening it only in the mutation's onSuccess (after
 * an await) is no longer inside the click's own event handler by the time
 * the browser sees it, so popup blockers can and do treat it as an
 * unsolicited popup. Its location is set once the signed URL is known, and
 * it's closed instead if the request fails or the URL doesn't resolve to
 * our own API origin (resolveDocumentAccessUrl fails closed -- see its own
 * comment -- so a malformed response can never be handed to the new tab).
 */
export function useBackupDownload() {
  const mutation = useMutation({
    mutationFn: (backupId: string) => adminSystemBackupsClient.requestAccess(backupId),
  });

  const downloadBackup = (backupId: string) => {
    const tab = window.open('', '_blank');
    // Sever window.opener the same way `noopener` would, without losing the
    // reference `noopener` itself would have discarded -- this tab still
    // needs to be navigated once the real URL is known.
    if (tab) tab.opener = null;

    mutation.mutate(backupId, {
      onSuccess: (access) => {
        const url = resolveDocumentAccessUrl(access.url, import.meta.env.VITE_API_BASE_URL ?? '');
        if (url && tab) {
          tab.location.href = url;
        } else {
          tab?.close();
        }
      },
      onError: () => {
        tab?.close();
      },
    });
  };

  return { downloadBackup, isPending: mutation.isPending, variables: mutation.variables, error: mutation.error };
}

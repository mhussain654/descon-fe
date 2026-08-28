/**
 * The admin document-access endpoint returns a relative, Rails-internal path
 * (`only_path: true` -- see descon-be's Admin::DocumentReviews::AccessService),
 * not a full URL. `VITE_API_BASE_URL` includes the `/api/v1` prefix this
 * path isn't under, so resolve against its *origin* only, not the whole
 * configured base URL.
 */
export function resolveDocumentAccessUrl(accessPath: string, apiBaseUrl: string): string {
  if (!accessPath) return '';
  if (!apiBaseUrl) return accessPath;
  try {
    return new URL(accessPath, new URL(apiBaseUrl).origin).toString();
  } catch {
    return accessPath;
  }
}

/**
 * Mirrors web/src/lib/resolveDocumentAccessUrl.ts exactly (a private
 * per-platform `lib/` utility, same as every other platform-specific
 * `*-client.ts` wiring file in this codebase -- not moved into `shared/`
 * purely for this one ticket's scope). The candidate flight-ticket access
 * endpoint returns a relative, Rails-internal path (`only_path: true`),
 * not a full URL. `EXPO_PUBLIC_API_BASE_URL` includes the `/api/v1` prefix
 * this path isn't under, so resolve against its *origin* only.
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

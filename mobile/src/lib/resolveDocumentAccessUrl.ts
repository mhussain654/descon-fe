/**
 * Mirrors web/src/lib/resolveDocumentAccessUrl.ts exactly (a private
 * per-platform `lib/` utility, same as every other platform-specific
 * `*-client.ts` wiring file in this codebase -- not moved into `shared/`
 * purely for this one ticket's scope). The candidate flight-ticket access
 * endpoint returns a relative, Rails-internal path (`only_path: true`),
 * not a full URL. `EXPO_PUBLIC_API_BASE_URL` includes the `/api/v1` prefix
 * this path isn't under, so resolve against its *origin* only.
 *
 * Fails closed (`null`) rather than ever returning an unvalidated value:
 * `accessPath` ultimately comes from a backend response, but a malformed
 * response, a future backend bug, or `accessPath` unexpectedly being an
 * absolute URL to a different origin (or a `javascript:`/`data:`/`file:`
 * scheme, none of which have an origin matching our own) must never reach
 * `Linking.openURL` unresolved. Comparing the *resolved* result's origin
 * against the expected one (rather than only validating `accessPath`
 * itself) catches all of those in one check, including a protocol-relative
 * `accessPath` ("//evil.example/x") that would silently adopt a different
 * host.
 */
export function resolveDocumentAccessUrl(accessPath: string, apiBaseUrl: string): string | null {
  if (!accessPath) return '';
  if (!apiBaseUrl) return null;

  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(apiBaseUrl).origin;
  } catch {
    return null;
  }

  let resolved: URL;
  try {
    resolved = new URL(accessPath, expectedOrigin);
  } catch {
    return null;
  }

  if (resolved.origin !== expectedOrigin) return null;
  return resolved.toString();
}

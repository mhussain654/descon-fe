/**
 * The admin document-access endpoint returns a relative, Rails-internal path
 * (`only_path: true` -- see descon-be's Admin::DocumentReviews::AccessService),
 * not a full URL. `VITE_API_BASE_URL` includes the `/api/v1` prefix this
 * path isn't under, so resolve against its *origin* only, not the whole
 * configured base URL.
 *
 * Fails closed (`null`) rather than ever returning an unvalidated value:
 * `accessPath` ultimately comes from a backend response, but a malformed
 * response, a future backend bug, or `accessPath` unexpectedly being an
 * absolute URL to a different origin (or a `javascript:`/`data:`/`file:`
 * scheme, none of which have an origin matching our own) must never reach
 * an `<img>`/`<embed>`/`<a href>` unresolved. Comparing the *resolved*
 * result's origin against the expected one (rather than only validating
 * `accessPath` itself) catches all of those in one check, including a
 * protocol-relative `accessPath` ("//evil.example/x") that would silently
 * adopt a different host.
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

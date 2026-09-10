// Pure helper shared by mobile's embedded-checkout WebView (see
// mobile/src/features/candidate/payments/components/HostedCheckoutWebView.tsx)
// to decide when the hosted checkout flow has looped back to our own
// backend. That endpoint renders raw JSON (it's an API response, not a
// page meant to be shown to the candidate), so reaching it is the signal to
// close the WebView -- never a signal of payment success by itself; only
// the caller's subsequent eligibility refetch decides that.
//
// Security note: this used to compare with `navigatingUrl.startsWith(apiBaseUrl)`
// and `.includes(RETURN_PATH_SEGMENT)`, both string-prefix/substring checks a
// lookalike domain defeats -- "https://api.descon.com.evil.example/payments/
// hosted_checkout/x/return" legitimately starts with "https://api.descon.com"
// and contains the path segment. Parse both URLs and compare the *origin*
// exactly, and validate the return path against a strict pattern instead.
const RETURN_PATH_PATTERN = /^\/payments\/hosted_checkout\/[a-z0-9_]+\/return\/?$/;

/** True once `navigatingUrl` has reached our own backend's hosted-checkout return endpoint. */
export function isHostedCheckoutReturnUrl(navigatingUrl: string, apiBaseUrl: string): boolean {
  if (!apiBaseUrl) return false;

  let base: URL;
  let target: URL;
  try {
    base = new URL(apiBaseUrl);
    target = new URL(navigatingUrl);
  } catch {
    return false;
  }

  // Origin equality also rejects a protocol downgrade (URL#origin includes
  // the scheme) -- but not embedded userinfo ("https://user:pass@host" has
  // the same origin as "https://host"), so that needs its own check.
  if (target.origin !== base.origin) return false;
  if (target.username || target.password) return false;

  const basePath = base.pathname.endsWith('/') ? base.pathname.slice(0, -1) : base.pathname;
  if (!target.pathname.startsWith(`${basePath}/`)) return false;

  const returnPath = target.pathname.slice(basePath.length);
  return RETURN_PATH_PATTERN.test(returnPath);
}

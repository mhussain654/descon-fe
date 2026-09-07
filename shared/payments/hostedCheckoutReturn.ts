// Pure helper shared by mobile's embedded-checkout WebView (see
// mobile/src/features/candidate/payments/components/HostedCheckoutWebView.tsx)
// to decide when the hosted checkout flow has looped back to our own
// backend. That endpoint renders raw JSON (it's an API response, not a
// page meant to be shown to the candidate), so reaching it is the signal to
// close the WebView -- never a signal of payment success by itself; only
// the caller's subsequent eligibility refetch decides that.
const RETURN_PATH_SEGMENT = '/payments/hosted_checkout/';

/** True once `navigatingUrl` has reached our own backend's hosted-checkout return endpoint. */
export function isHostedCheckoutReturnUrl(navigatingUrl: string, apiBaseUrl: string): boolean {
  if (!apiBaseUrl || !navigatingUrl.startsWith(apiBaseUrl)) return false;
  return navigatingUrl.includes(RETURN_PATH_SEGMENT);
}

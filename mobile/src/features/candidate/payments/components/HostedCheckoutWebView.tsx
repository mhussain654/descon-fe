import { useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { X } from 'lucide-react-native';
import { Button, IconButton, Spinner } from '../../../../design-system';
import { colors, spacing, typeScale } from '../../../../design-system/tokens';
import { isHostedCheckoutReturnUrl } from '../../../../../../shared/payments/hostedCheckoutReturn';

export interface HostedCheckoutWebViewProps {
  /** The provider's hosted checkout URL, or `null` when nothing is in progress. */
  url: string | null;
  onClose: () => void;
  closeLabel: string;
  loadingLabel: string;
  /** Shown in place of the WebView once a navigation attempt is blocked. */
  blockedMessage: string;
}

/** Origin a WebView is allowed to navigate to/within. `null` origin (e.g. `javascript:`, `data:`) never matches. */
function originOf(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).origin;
  } catch {
    return null;
  }
}

const KUICKPAY_HOST_PATTERN = /(^|\.)kuickpay\.com$/i;

/**
 * Whether `origin` is one this WebView may ever open or navigate within,
 * for this specific checkout session:
 *  - the provider's own hosted-checkout origin (KuickPay, or -- development
 *    only -- our own API origin, which is where PAYMENT_PROVIDER=
 *    mock_hosted_checkout serves its stand-in checkout page from, same-origin
 *    with the API per MockCheckoutsController)
 *  - our own API origin (where the return endpoint lives)
 * Everything else -- a redirect to an unrelated domain, a phishing lookalike,
 * a `javascript:`/`data:`/`file:` scheme -- is rejected.
 */
function isAllowedOrigin(origin: string | null, checkoutOrigin: string | null, apiOrigin: string | null): boolean {
  if (!origin) return false;
  if (origin === checkoutOrigin) return true;
  if (origin === apiOrigin) return true;
  try {
    const parsed = new URL(origin);
    return parsed.protocol === 'https:' && KUICKPAY_HOST_PATTERN.test(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Renders the hosted checkout page inline instead of handing the candidate
 * off to an external browser tab -- a native WebView isn't subject to the
 * browser-only X-Frame-Options/CSP frame-ancestors mechanism a web
 * `<iframe>` would be, so this works regardless of what the payment
 * provider sets. Auto-closes once navigation reaches our own backend's
 * return endpoint (it renders raw JSON, not a page meant to be shown) --
 * either way, closing never implies the payment succeeded; only the
 * caller's subsequent eligibility refetch decides that.
 *
 * Navigation is restricted to an explicit origin allowlist
 * (`onShouldStartLoadWithRequest`, checked *before* a navigation happens --
 * unlike `onNavigationStateChange`, which only observes navigation after the
 * fact and cannot block it) -- a compromised provider page or an
 * unexpected redirect can otherwise navigate the WebView anywhere,
 * including a phishing page rendered inside what looks like our own
 * payment flow.
 */
export function HostedCheckoutWebView({ url, onClose, closeLabel, loadingLabel, blockedMessage }: HostedCheckoutWebViewProps) {
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
  const apiOrigin = useMemo(() => originOf(apiBaseUrl), [apiBaseUrl]);
  const checkoutOrigin = useMemo(() => (url ? originOf(url) : null), [url]);
  const [isBlocked, setIsBlocked] = useState(false);

  // `ShouldStartLoadRequest` (the type onShouldStartLoadWithRequest actually
  // receives) isn't re-exported from this package's public entry point --
  // only `WebViewNavigation` is, which it extends and which has every field
  // this handler needs (just `.url`).
  const handleShouldStartLoad = (request: WebViewNavigation): boolean => {
    const allowed = isAllowedOrigin(originOf(request.url), checkoutOrigin, apiOrigin);
    if (!allowed) setIsBlocked(true);
    return allowed;
  };

  const handleNavigationStateChange = (navState: WebViewNavigation) => {
    // Payment success is never inferred here -- reaching the return endpoint
    // only closes the WebView; the caller's own eligibility refetch is what
    // actually decides success.
    if (isHostedCheckoutReturnUrl(navState.url, apiBaseUrl)) onClose();
  };

  return (
    <Modal visible={url !== null} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.header}>
        <IconButton icon={<X size={20} color={colors.text.primary} />} label={closeLabel} onPress={onClose} variant="ghost" />
      </View>
      {url && isBlocked ? (
        <View style={styles.blocked}>
          <Text style={styles.blockedText}>{blockedMessage}</Text>
          <Button onPress={onClose} variant="outline">
            {closeLabel}
          </Button>
        </View>
      ) : url ? (
        <WebView
          source={{ uri: url }}
          style={styles.webview}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <Spinner size="lg" label={loadingLabel} />
            </View>
          )}
          onShouldStartLoadWithRequest={handleShouldStartLoad}
          onNavigationStateChange={handleNavigationStateChange}
        />
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: spacing[3],
    backgroundColor: colors.surface.raised,
  },
  webview: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[4], padding: spacing[6] },
  blockedText: { ...typeScale.body, color: colors.text.primary, textAlign: 'center' },
});

import { Modal, StyleSheet, View } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { X } from 'lucide-react-native';
import { IconButton, Spinner } from '../../../../design-system';
import { colors, spacing } from '../../../../design-system/tokens';
import { isHostedCheckoutReturnUrl } from '../../../../../../shared/payments/hostedCheckoutReturn';

export interface HostedCheckoutWebViewProps {
  /** The provider's hosted checkout URL, or `null` when nothing is in progress. */
  url: string | null;
  onClose: () => void;
  closeLabel: string;
  loadingLabel: string;
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
 */
export function HostedCheckoutWebView({ url, onClose, closeLabel, loadingLabel }: HostedCheckoutWebViewProps) {
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

  const handleNavigationStateChange = (navState: WebViewNavigation) => {
    if (isHostedCheckoutReturnUrl(navState.url, apiBaseUrl)) onClose();
  };

  return (
    <Modal visible={url !== null} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.header}>
        <IconButton icon={<X size={20} color={colors.text.primary} />} label={closeLabel} onPress={onClose} variant="ghost" />
      </View>
      {url ? (
        <WebView
          source={{ uri: url }}
          style={styles.webview}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <Spinner size="lg" label={loadingLabel} />
            </View>
          )}
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
});

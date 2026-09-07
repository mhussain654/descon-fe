import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { HostedCheckoutWebView } from './HostedCheckoutWebView';

const API_BASE_URL = 'https://4e24-2400-adc5.ngrok-free.app/api/v1';

let latestWebViewProps: any = null;
jest.mock('react-native-webview', () => {
  const { View } = require('react-native');
  return {
    WebView: (props: any) => {
      latestWebViewProps = props;
      return <View testID="webview" />;
    },
  };
});

const ORIGINAL_ENV = process.env.EXPO_PUBLIC_API_BASE_URL;

function renderCheckout(url: string, onClose = jest.fn()) {
  render(
    <HostedCheckoutWebView
      url={url}
      onClose={onClose}
      closeLabel="Close"
      loadingLabel="Loading…"
      blockedMessage="This page tried to open an untrusted location, so it was blocked."
    />
  );
  return onClose;
}

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_BASE_URL = API_BASE_URL;
});

afterEach(() => {
  process.env.EXPO_PUBLIC_API_BASE_URL = ORIGINAL_ENV;
  latestWebViewProps = null;
});

describe('HostedCheckoutWebView', () => {
  it('renders nothing when there is no checkout URL', () => {
    render(
      <HostedCheckoutWebView
        url={null}
        onClose={jest.fn()}
        closeLabel="Close"
        loadingLabel="Loading…"
        blockedMessage="Blocked"
      />
    );

    expect(screen.queryByTestId('webview')).not.toBeOnTheScreen();
  });

  it('loads the given checkout URL once one is set', () => {
    renderCheckout('https://sandbox-api.kuickpay.com/checkout/session-1');

    expect(screen.getByTestId('webview')).toBeOnTheScreen();
    expect(latestWebViewProps.source).toEqual({ uri: 'https://sandbox-api.kuickpay.com/checkout/session-1' });
  });

  it('calls onClose when the candidate taps the close control', () => {
    const onClose = renderCheckout('https://sandbox-api.kuickpay.com/checkout/session-1');

    fireEvent.press(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose once navigation reaches our own backend return endpoint', () => {
    const onClose = renderCheckout('https://sandbox-api.kuickpay.com/checkout/session-1');

    latestWebViewProps.onNavigationStateChange({ url: `${API_BASE_URL}/payments/hosted_checkout/kuickpay/return` });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose while still navigating the provider pages', () => {
    const onClose = renderCheckout('https://sandbox-api.kuickpay.com/checkout/session-1');

    latestWebViewProps.onNavigationStateChange({ url: 'https://sandbox-api.kuickpay.com/checkout/card-entry' });

    expect(onClose).not.toHaveBeenCalled();
  });

  describe('navigation allowlist (onShouldStartLoadWithRequest)', () => {
    it('allows navigation within the initial checkout origin', () => {
      renderCheckout('https://sandbox-api.kuickpay.com/checkout/session-1');

      expect(latestWebViewProps.onShouldStartLoadWithRequest({ url: 'https://sandbox-api.kuickpay.com/checkout/card-entry' })).toBe(
        true
      );
    });

    it('allows navigation to a kuickpay.com subdomain other than the initial one', () => {
      renderCheckout('https://sandbox-api.kuickpay.com/checkout/session-1');

      expect(latestWebViewProps.onShouldStartLoadWithRequest({ url: 'https://otp.kuickpay.com/verify' })).toBe(true);
    });

    it('allows navigation to our own API origin (the return endpoint)', () => {
      renderCheckout('https://sandbox-api.kuickpay.com/checkout/session-1');

      expect(
        latestWebViewProps.onShouldStartLoadWithRequest({ url: `${API_BASE_URL}/payments/hosted_checkout/kuickpay/return` })
      ).toBe(true);
    });

    it('allows the same-origin mock checkout page in development (mock provider is same-origin as the API)', () => {
      renderCheckout(`${API_BASE_URL}/mock_checkouts/order-1`);

      expect(latestWebViewProps.onShouldStartLoadWithRequest({ url: `${API_BASE_URL}/mock_checkouts/order-1` })).toBe(true);
    });

    function checkBlocked(url: string): boolean {
      let allowed: boolean = true;
      act(() => {
        allowed = latestWebViewProps.onShouldStartLoadWithRequest({ url });
      });
      return allowed;
    }

    it('blocks navigation to an unrelated domain and shows a safe error', () => {
      renderCheckout('https://sandbox-api.kuickpay.com/checkout/session-1');

      expect(checkBlocked('https://evil.example/phish')).toBe(false);
      expect(screen.getByText('This page tried to open an untrusted location, so it was blocked.')).toBeOnTheScreen();
      expect(screen.queryByTestId('webview')).not.toBeOnTheScreen();
    });

    it('blocks a kuickpay.com lookalike domain', () => {
      renderCheckout('https://sandbox-api.kuickpay.com/checkout/session-1');

      expect(checkBlocked('https://kuickpay.com.evil.example/phish')).toBe(false);
    });

    it('blocks a javascript: URL', () => {
      renderCheckout('https://sandbox-api.kuickpay.com/checkout/session-1');

      expect(checkBlocked('javascript:alert(1)')).toBe(false);
    });

    it('blocks a data: URL', () => {
      renderCheckout('https://sandbox-api.kuickpay.com/checkout/session-1');

      expect(checkBlocked('data:text/html,<script>alert(1)</script>')).toBe(false);
    });

    it('blocks a file: URL', () => {
      renderCheckout('https://sandbox-api.kuickpay.com/checkout/session-1');

      expect(checkBlocked('file:///etc/passwd')).toBe(false);
    });

    it('blocks an HTTP downgrade of an otherwise-allowed origin', () => {
      renderCheckout('https://sandbox-api.kuickpay.com/checkout/session-1');

      expect(checkBlocked('http://sandbox-api.kuickpay.com/checkout/card-entry')).toBe(false);
    });

    it('closing after a blocked navigation calls onClose', () => {
      const onClose = renderCheckout('https://sandbox-api.kuickpay.com/checkout/session-1');
      act(() => {
        latestWebViewProps.onShouldStartLoadWithRequest({ url: 'https://evil.example/phish' });
      });

      // Both the header's icon button and the blocked-state's button are
      // labeled "Close" once blocked -- either one ends the flow the same way.
      const [closeButton] = screen.getAllByRole('button', { name: 'Close' });
      fireEvent.press(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});

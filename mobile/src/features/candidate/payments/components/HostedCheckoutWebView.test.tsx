import { fireEvent, render, screen } from '@testing-library/react-native';
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

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_BASE_URL = API_BASE_URL;
});

afterEach(() => {
  process.env.EXPO_PUBLIC_API_BASE_URL = ORIGINAL_ENV;
  latestWebViewProps = null;
});

describe('HostedCheckoutWebView', () => {
  it('renders nothing when there is no checkout URL', () => {
    render(<HostedCheckoutWebView url={null} onClose={jest.fn()} closeLabel="Close" loadingLabel="Loading…" />);

    expect(screen.queryByTestId('webview')).not.toBeOnTheScreen();
  });

  it('loads the given checkout URL once one is set', () => {
    render(
      <HostedCheckoutWebView
        url="https://sandbox-api.kuickpay.com/checkout/session-1"
        onClose={jest.fn()}
        closeLabel="Close"
        loadingLabel="Loading…"
      />
    );

    expect(screen.getByTestId('webview')).toBeOnTheScreen();
    expect(latestWebViewProps.source).toEqual({ uri: 'https://sandbox-api.kuickpay.com/checkout/session-1' });
  });

  it('calls onClose when the candidate taps the close control', () => {
    const onClose = jest.fn();
    render(
      <HostedCheckoutWebView
        url="https://sandbox-api.kuickpay.com/checkout/session-1"
        onClose={onClose}
        closeLabel="Close"
        loadingLabel="Loading…"
      />
    );

    fireEvent.press(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose once navigation reaches our own backend return endpoint', () => {
    const onClose = jest.fn();
    render(
      <HostedCheckoutWebView
        url="https://sandbox-api.kuickpay.com/checkout/session-1"
        onClose={onClose}
        closeLabel="Close"
        loadingLabel="Loading…"
      />
    );

    latestWebViewProps.onNavigationStateChange({ url: `${API_BASE_URL}/payments/hosted_checkout/kuickpay/return` });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose while still navigating the provider pages', () => {
    const onClose = jest.fn();
    render(
      <HostedCheckoutWebView
        url="https://sandbox-api.kuickpay.com/checkout/session-1"
        onClose={onClose}
        closeLabel="Close"
        loadingLabel="Loading…"
      />
    );

    latestWebViewProps.onNavigationStateChange({ url: 'https://sandbox-api.kuickpay.com/checkout/card-entry' });

    expect(onClose).not.toHaveBeenCalled();
  });
});

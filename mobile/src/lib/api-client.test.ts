// Regression coverage for MPS-206: `shared/api-client.ts`'s `isOnline` option
// defaults to `navigator.onLine`, which isn't reliably present in React
// Native -- without wiring NetInfo through here, a genuinely offline device
// would always be misreported as a NETWORK_ERROR instead of OFFLINE.
type NetInfoListener = (state: { isConnected: boolean | null; isInternetReachable: boolean | null }) => void;

let netInfoCallback: NetInfoListener | undefined;

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn((callback: NetInfoListener) => {
    netInfoCallback = callback;
    return () => {};
  }),
}));

import { apiClient } from './api-client';

describe('apiClient (mobile) connectivity wiring', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('registers a NetInfo listener so connectivity state is available synchronously', () => {
    expect(netInfoCallback).toBeDefined();
  });

  it('reports OFFLINE, not NETWORK_ERROR, once NetInfo says the device has no connectivity', async () => {
    netInfoCallback?.({ isConnected: false, isInternetReachable: false });
    globalThis.fetch = jest.fn(() => Promise.reject(new TypeError('Network request failed'))) as typeof fetch;

    await expect(apiClient.get('/ping')).rejects.toMatchObject({ code: 'OFFLINE' });
  });

  it('reports NETWORK_ERROR when NetInfo says the device is connected but the request still fails', async () => {
    netInfoCallback?.({ isConnected: true, isInternetReachable: true });
    globalThis.fetch = jest.fn(() => Promise.reject(new TypeError('Network request failed'))) as typeof fetch;

    await expect(apiClient.get('/ping')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });
});

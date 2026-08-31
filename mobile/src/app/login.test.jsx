import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../contexts/AuthContext';
import { LanguageProvider } from '../contexts/LanguageContext';
import { Toaster } from '../design-system/toast';
import { createQueryClientTestLifecycle } from '../testSupport/queryClientTestLifecycle';
import LoginScreen from './login';

// `initialWindowMetrics` is null under Jest (it's populated by a native
// module), which otherwise leaves useSafeAreaInsets() permanently
// unresolved and the screen never renders past <SafeAreaProvider />.
const TEST_SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), back: jest.fn() }),
  Redirect: ({ href }) => {
    const { Text: MockText } = jest.requireActual('react-native');
    return <MockText>redirect:{href}</MockText>;
  },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => () => {}),
}));

// auth-client.ts now calls the real MPS-201 backend (MPS-206) -- these
// screen tests exercise the UI flow, not networking, so fetch is mocked at
// the boundary rather than left to hit a real (absent, in Jest) server.
// Per AGENTS.md: "Mock the centralized API boundary ... Do not call live
// backend or provider services from unit/component tests."
// `resend_after_seconds: 0` (rather than a real-world value) means the
// "Resend OTP" button is immediately actionable in every test without
// needing fake timers -- resend-specific tests below aren't otherwise
// exercising this cooldown, only the separate server-enforced rate limit.
function otpRequestSuccessResponse() {
  return new Response(
    // Rails wraps every 2xx response as `{ data, meta, errors: [] }` (openapi.yaml's SuccessEnvelope).
    JSON.stringify({ data: { expires_in_seconds: 300, resend_after_seconds: 0 }, meta: {}, errors: [] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

function rateLimitedResponse(retryAfterSeconds) {
  return new Response(
    JSON.stringify({ errors: [{ code: 'rate_limited', message: 'Too many requests' }], request_id: 'req-1' }),
    { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(retryAfterSeconds) } }
  );
}

function otpVerifySuccessResponse() {
  return new Response(
    JSON.stringify({
      data: {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        token_type: 'bearer',
        expires_in: 3600,
        session: { id: 'session-1' },
        candidate: { id: 'candidate-1', full_name: 'Ahmed Ali', preferred_locale: 'en' },
      },
      meta: {},
      errors: [],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

// api-client.ts caches NetInfo's reachability state at module scope (see its
// own comment), fed by exactly one `NetInfo.addEventListener` call made when
// the module first loads -- so the listener it registered is captured here
// once and reused to simulate connectivity transitions, the same way this
// file already reaches into the expo-secure-store mock's captured calls.
function setNetworkOnline(isOnline) {
  const netInfoMock = jest.requireMock('@react-native-community/netinfo');
  const listener = netInfoMock.addEventListener.mock.calls[0]?.[0];
  listener?.({ isConnected: isOnline, isInternetReachable: isOnline });
}

const originalFetch = globalThis.fetch;
beforeEach(() => {
  globalThis.fetch = jest.fn((url) => {
    if (typeof url === 'string' && url.includes('/candidate/auth/otp/request')) {
      return Promise.resolve(otpRequestSuccessResponse());
    }
    return Promise.reject(new Error(`login.test.jsx: unexpected fetch to ${url}`));
  });
  // api-client.ts's connectivity flag is module-scoped and outlives any one
  // test -- start every test from a known "online" baseline regardless of
  // what an earlier offline-handling test last left it as.
  setNetworkOnline(true);
});

const { createTestQueryClient, trackRender, cleanup } = createQueryClientTestLifecycle();

afterEach(async () => {
  globalThis.fetch = originalFetch;
  await cleanup();
  // Otherwise a test that persists 'ur' (AsyncStorage) leaks into whichever
  // test runs next, since LanguageProvider reads it back on every mount.
  await AsyncStorage.clear();
});

function renderLoginScreen() {
  const queryClient = createTestQueryClient();
  return trackRender(
    render(
      <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <AuthProvider>
              <LoginScreen />
              <Toaster />
            </AuthProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    )
  );
}

describe('LoginScreen', () => {
  it('contains exactly one user-input field: CNIC -- no mobile number, email or password', async () => {
    renderLoginScreen();
    await screen.findByLabelText('CNIC Number');

    expect(screen.queryByLabelText(/mobile/i)).toBeNull();
    expect(screen.queryByLabelText(/password/i)).toBeNull();
    expect(screen.queryByLabelText(/email/i)).toBeNull();
  });

  it('never renders any signup/registration affordance', async () => {
    renderLoginScreen();
    await screen.findByLabelText('CNIC Number');

    expect(screen.queryByText(/sign up/i)).toBeNull();
    expect(screen.queryByText(/register/i)).toBeNull();
    expect(screen.queryByText(/create an account/i)).toBeNull();
  });

  it('shows a required-field error for an empty CNIC submission', async () => {
    renderLoginScreen();
    fireEvent.press(await screen.findByRole('button', { name: 'Send OTP' }));
    expect(await screen.findByText('Enter your CNIC to continue.')).toBeOnTheScreen();
  });

  it('moves to the OTP step, showing only the OTP field, after a valid CNIC submission', async () => {
    renderLoginScreen();
    fireEvent.changeText(await screen.findByLabelText('CNIC Number'), '1234512345671');
    fireEvent.press(screen.getByRole('button', { name: 'Send OTP' }));

    await waitFor(() => expect(screen.getByLabelText('One-Time Password')).toBeOnTheScreen());
    expect(screen.queryByLabelText('CNIC Number')).toBeNull();
  });

  it('renders in Urdu when that is the persisted language, with a long-text error that is not clipped', async () => {
    await AsyncStorage.setItem('descon.language', 'ur');
    renderLoginScreen();

    const input = await screen.findByLabelText('شناختی کارڈ نمبر');
    expect(input.props.placeholder).toBe('اپنا شناختی کارڈ نمبر درج کریں');

    fireEvent.press(screen.getByRole('button', { name: 'او ٹی پی بھیجیں' }));
    const message = await screen.findByText('جاری رکھنے کے لیے اپنا شناختی کارڈ نمبر درج کریں۔');
    expect(message).toBeOnTheScreen();
    // No numberOfLines constraint anywhere in the ValidationMessage tree -- long Urdu text wraps instead of clipping.
    expect(message.props.numberOfLines).toBeUndefined();
  });

  describe('server-enforced rate limiting (Retry-After)', () => {
    it('shows a live countdown and disables Send OTP after the CNIC step is rate-limited', async () => {
      globalThis.fetch = jest.fn(() => Promise.resolve(rateLimitedResponse(30)));
      renderLoginScreen();

      fireEvent.changeText(await screen.findByLabelText('CNIC Number'), '1234512345671');
      fireEvent.press(screen.getByRole('button', { name: 'Send OTP' }));

      await waitFor(() => expect(screen.getByText('You can try again in 0:30')).toBeOnTheScreen());
      expect(screen.getByRole('button', { name: 'Send OTP' })).toBeDisabled();
    });

    it('shows a live countdown and disables Verify after OTP verification is rate-limited', async () => {
      renderLoginScreen();
      fireEvent.changeText(await screen.findByLabelText('CNIC Number'), '1234512345671');
      fireEvent.press(screen.getByRole('button', { name: 'Send OTP' }));
      await waitFor(() => expect(screen.getByLabelText('One-Time Password')).toBeOnTheScreen());

      globalThis.fetch = jest.fn((url) => {
        if (typeof url === 'string' && url.includes('/candidate/auth/otp/verify')) {
          return Promise.resolve(rateLimitedResponse(20));
        }
        return Promise.reject(new Error(`login.test.jsx: unexpected fetch to ${url}`));
      });
      fireEvent.changeText(screen.getByLabelText('One-Time Password'), '123456');

      await waitFor(() => expect(screen.getByText('You can try again in 0:20')).toBeOnTheScreen());
      expect(screen.getByRole('button', { name: 'Verify & Login' })).toBeDisabled();
    });

    it('shows a live countdown after a resend is rate-limited, independent of the Verify action', async () => {
      renderLoginScreen();
      fireEvent.changeText(await screen.findByLabelText('CNIC Number'), '1234512345671');
      fireEvent.press(screen.getByRole('button', { name: 'Send OTP' }));
      await waitFor(() => expect(screen.getByLabelText('One-Time Password')).toBeOnTheScreen());

      globalThis.fetch = jest.fn(() => Promise.resolve(rateLimitedResponse(12)));
      fireEvent.press(screen.getByRole('button', { name: 'Resend OTP' }));

      await waitFor(() =>
        expect(screen.getAllByText('You can resend in 0:12').length).toBeGreaterThan(0)
      );
      // This is the resend-scoped cooldown wording, not the verify-scoped
      // "You can try again in" copy -- the two rate limits render distinct
      // messages (see the useCnicOtpFlow hook tests for the corresponding
      // "verify still callable while resend is rate-limited" behavior).
      expect(screen.queryByText(/You can try again in/)).toBeNull();
    });

    it('shows the CNIC-step countdown in Urdu', async () => {
      await AsyncStorage.setItem('descon.language', 'ur');
      globalThis.fetch = jest.fn(() => Promise.resolve(rateLimitedResponse(30)));
      renderLoginScreen();

      fireEvent.changeText(await screen.findByLabelText('شناختی کارڈ نمبر'), '1234512345671');
      fireEvent.press(screen.getByRole('button', { name: 'او ٹی پی بھیجیں' }));

      await waitFor(() => expect(screen.getByText('آپ دوبارہ کوشش کر سکیں گے 0:30')).toBeOnTheScreen());
      expect(screen.getByRole('button', { name: 'او ٹی پی بھیجیں' })).toBeDisabled();
    });
  });

  describe('offline handling (candidate CNIC/OTP journey)', () => {
    it('shows the dedicated offline state -- not the generic error text -- and preserves the entered CNIC when the OTP request fails offline', async () => {
      setNetworkOnline(false);
      globalThis.fetch = jest.fn(() => Promise.reject(new TypeError('Network request failed')));
      renderLoginScreen();

      fireEvent.changeText(await screen.findByLabelText('CNIC Number'), '1234512345671');
      fireEvent.press(screen.getByRole('button', { name: 'Send OTP' }));

      expect(await screen.findByText('You are offline')).toBeOnTheScreen();
      expect(screen.getByText('Check your internet connection and try again.')).toBeOnTheScreen();
      // The generic authentication error presentation must not also render for this failure.
      expect(screen.queryByRole('button', { name: 'Send OTP' })).toBeNull();
      expect(screen.getByLabelText('CNIC Number').props.value).not.toBe('');

      setNetworkOnline(true);
      const retryFetch = jest.fn((url) => {
        if (typeof url === 'string' && url.includes('/candidate/auth/otp/request')) {
          return Promise.resolve(otpRequestSuccessResponse());
        }
        return Promise.reject(new Error(`unexpected fetch to ${url}`));
      });
      globalThis.fetch = retryFetch;

      fireEvent.press(screen.getByRole('button', { name: 'Retry' }));

      await waitFor(() => expect(screen.getByLabelText('One-Time Password')).toBeOnTheScreen());
      expect(retryFetch).toHaveBeenCalledTimes(1);
    });

    it('does not start a duplicate OTP request when Retry is pressed more than once', async () => {
      setNetworkOnline(false);
      globalThis.fetch = jest.fn(() => Promise.reject(new TypeError('Network request failed')));
      renderLoginScreen();

      fireEvent.changeText(await screen.findByLabelText('CNIC Number'), '1234512345671');
      fireEvent.press(screen.getByRole('button', { name: 'Send OTP' }));
      expect(await screen.findByText('You are offline')).toBeOnTheScreen();

      setNetworkOnline(true);
      let callCount = 0;
      let releasePendingFetch;
      const pending = new Promise((resolve) => {
        releasePendingFetch = resolve;
      });
      globalThis.fetch = jest.fn(() => {
        callCount += 1;
        // Stays in-flight until released below -- simulates a still-pending
        // request so a second/third tap while it's outstanding is
        // observable as either producing another call (a bug) or not
        // (correct), rather than racing a request that already settled.
        return pending.then(() => Promise.reject(new TypeError('Network request failed')));
      });

      const retryButton = screen.getByRole('button', { name: 'Retry' });
      fireEvent.press(retryButton);
      fireEvent.press(retryButton);
      fireEvent.press(retryButton);

      expect(callCount).toBe(1);

      // Let the in-flight request settle so no timers/promises outlive this test.
      releasePendingFetch();
      await waitFor(() => expect(screen.getByText('You are offline')).toBeOnTheScreen());
    });

    it('shows the dedicated offline state and preserves the entered OTP when verification fails offline, and Retry re-attempts verification (not a resend)', async () => {
      renderLoginScreen();
      fireEvent.changeText(await screen.findByLabelText('CNIC Number'), '1234512345671');
      fireEvent.press(screen.getByRole('button', { name: 'Send OTP' }));
      await waitFor(() => expect(screen.getByLabelText('One-Time Password')).toBeOnTheScreen());

      setNetworkOnline(false);
      globalThis.fetch = jest.fn(() => Promise.reject(new TypeError('Network request failed')));
      fireEvent.changeText(screen.getByLabelText('One-Time Password'), '123456');

      expect(await screen.findByText('You are offline')).toBeOnTheScreen();
      expect(screen.getByLabelText('One-Time Password').props.value).toBe('123456');

      setNetworkOnline(true);
      const verifyFetch = jest.fn((url) => {
        if (typeof url === 'string' && url.includes('/candidate/auth/otp/verify')) {
          return Promise.resolve(otpVerifySuccessResponse());
        }
        return Promise.reject(new Error(`unexpected fetch to ${url}`));
      });
      globalThis.fetch = verifyFetch;

      fireEvent.press(screen.getByRole('button', { name: 'Retry' }));

      // Verification succeeding logs the candidate in, which -- since Login
      // is itself guarded by RequireGuest -- immediately redirects away from
      // the login screen. That redirect is the clearest proof the retried
      // call was actually verifyOtp (a resend would just reissue a
      // challenge and leave the candidate on this same screen).
      await waitFor(() => expect(screen.getByText('redirect:/(tabs)/dashboard')).toBeOnTheScreen());
      expect(verifyFetch).toHaveBeenCalledTimes(1);
      expect(verifyFetch.mock.calls[0][0]).toEqual(expect.stringContaining('/candidate/auth/otp/verify'));
    });

    it('when a resend fails offline, Retry re-attempts the resend rather than verification', async () => {
      renderLoginScreen();
      fireEvent.changeText(await screen.findByLabelText('CNIC Number'), '1234512345671');
      fireEvent.press(screen.getByRole('button', { name: 'Send OTP' }));
      await waitFor(() => expect(screen.getByLabelText('One-Time Password')).toBeOnTheScreen());

      setNetworkOnline(false);
      globalThis.fetch = jest.fn(() => Promise.reject(new TypeError('Network request failed')));
      fireEvent.press(screen.getByRole('button', { name: 'Resend OTP' }));

      expect(await screen.findByText('You are offline')).toBeOnTheScreen();

      setNetworkOnline(true);
      const resendFetch = jest.fn((url) => {
        if (typeof url === 'string' && url.includes('/candidate/auth/otp/request')) {
          return Promise.resolve(otpRequestSuccessResponse());
        }
        return Promise.reject(new Error(`unexpected fetch to ${url}`));
      });
      globalThis.fetch = resendFetch;

      fireEvent.press(screen.getByRole('button', { name: 'Retry' }));

      // The offline state clears and the OTP field/resend affordance return
      // -- if verification had been retried instead, an invalid 6-digit
      // code would surface as an OTP_INVALID/other error, not this.
      await waitFor(() => expect(screen.queryByText('You are offline')).toBeNull());
      expect(resendFetch).toHaveBeenCalledTimes(1);
      expect(resendFetch.mock.calls[0][0]).toEqual(expect.stringContaining('/candidate/auth/otp/request'));
      expect(screen.getByLabelText('One-Time Password')).toBeOnTheScreen();
    });
  });

  describe('already-authenticated redirect', () => {
    it('redirects an already-authenticated candidate to the dashboard instead of showing Login', async () => {
      const secureStoreMock = jest.requireMock('expo-secure-store');
      secureStoreMock.getItemAsync.mockImplementationOnce(() =>
        Promise.resolve(
          JSON.stringify({
            accessToken: 'token',
            refreshToken: 'refresh',
            candidateId: 'candidate_1',
            candidateName: 'Ahmed Ali',
            preferredLocale: 'en',
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          })
        )
      );

      renderLoginScreen();

      await waitFor(() => expect(screen.getByText('redirect:/(tabs)/dashboard')).toBeOnTheScreen());
      expect(screen.queryByLabelText('CNIC Number')).toBeNull();
    });
  });
});

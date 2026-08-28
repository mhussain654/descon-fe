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

const originalFetch = globalThis.fetch;
beforeEach(() => {
  globalThis.fetch = jest.fn((url) => {
    if (typeof url === 'string' && url.includes('/candidate/auth/otp/request')) {
      return Promise.resolve(otpRequestSuccessResponse());
    }
    return Promise.reject(new Error(`login.test.jsx: unexpected fetch to ${url}`));
  });
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
});

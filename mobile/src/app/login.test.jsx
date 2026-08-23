import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../contexts/AuthContext';
import { LanguageProvider } from '../contexts/LanguageContext';
import { Toaster } from '../design-system/toast';
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

function renderLoginScreen() {
  return render(
    <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
      <LanguageProvider>
        <AuthProvider>
          <LoginScreen />
          <Toaster />
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
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
});

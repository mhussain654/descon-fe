import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../contexts/AuthContext';
import { LanguageProvider } from '../contexts/LanguageContext';
import { createQueryClientTestLifecycle } from '../testSupport/queryClientTestLifecycle';
import WelcomeScreen from './welcome';

// `initialWindowMetrics` is null under Jest, which otherwise leaves
// useSafeAreaInsets() permanently unresolved (see login.test.jsx).
const TEST_SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const mockSetScheme = jest.fn(() => Promise.resolve());
jest.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({ scheme: 'light', setScheme: mockSetScheme }),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  Redirect: ({ href }) => {
    const { Text: MockText } = jest.requireActual('react-native');
    return <MockText>redirect:{href}</MockText>;
  },
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-secure-store', () => {
  let store = {};
  return {
    getItemAsync: jest.fn((key) => Promise.resolve(store[key] ?? null)),
    setItemAsync: jest.fn((key, value) => {
      store[key] = value;
      return Promise.resolve();
    }),
    deleteItemAsync: jest.fn((key) => {
      delete store[key];
      return Promise.resolve();
    }),
    __reset: () => {
      store = {};
    },
    __setRaw: (key, value) => {
      store[key] = value;
    },
  };
});

const { createTestQueryClient, trackRender, cleanup } = createQueryClientTestLifecycle();

function renderWelcomeScreen() {
  const queryClient = createTestQueryClient();
  return trackRender(
    render(
      <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <AuthProvider>
              <WelcomeScreen />
            </AuthProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    )
  );
}

describe('WelcomeScreen', () => {
  beforeEach(() => {
    jest.requireMock('expo-secure-store').__reset();
  });

  afterEach(async () => {
    await cleanup();
    // The Urdu test persists its choice; keep later tests in English.
    await AsyncStorage.removeItem('descon.language');
  });

  it('renders the language/continue screen once restoration finds no session', async () => {
    renderWelcomeScreen();
    expect(await screen.findByRole('button', { name: 'Continue' })).toBeOnTheScreen();
  });

  it("shows the client's design in English: logo row, welcome, tag line and the language choice", async () => {
    renderWelcomeScreen();

    expect(await screen.findByText('Choose your language')).toBeOnTheScreen();
    expect(screen.getByLabelText('MPS Connect')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Welcome to MPS Connect' })).toBeOnTheScreen();
    expect(screen.getByText('Your Gateway to Overseas Employment.')).toBeOnTheScreen();
    expect(screen.getByText('You can change it later from your profile.')).toBeOnTheScreen();
    expect(screen.getByText('Continue in English')).toBeOnTheScreen();
    expect(screen.getByText('اردو میں جاری رکھیں')).toBeOnTheScreen();
    expect(screen.getByText('Securely managed by Descon Manpower Services')).toBeOnTheScreen();
  });

  it('lets a signed-out candidate switch to dark mode from the language page', async () => {
    renderWelcomeScreen();

    fireEvent.press(await screen.findByRole('button', { name: 'Switch to dark mode' }));

    expect(mockSetScheme).toHaveBeenCalledWith('dark', undefined);
  });

  it('shows the welcome only in the chosen language -- no Urdu welcome while English is selected', async () => {
    renderWelcomeScreen();
    await screen.findByText('Choose your language');

    expect(screen.queryByText('ایم پی ایس کنیکٹ میں خوش آمدید')).toBeNull();
    expect(screen.queryByText('اپنی زبان منتخب کریں')).toBeNull();
  });

  it('shows the whole page, welcome included, in Urdu once Urdu is chosen', async () => {
    renderWelcomeScreen();
    fireEvent.press(await screen.findByRole('button', { name: /اردو/ }));

    expect(await screen.findByText('ایم پی ایس کنیکٹ میں خوش آمدید')).toBeOnTheScreen();
    expect(screen.getByText('بیرونِ ملک روزگار کے لیے آپ کا راستہ')).toBeOnTheScreen();
    expect(screen.getByText('اپنی زبان منتخب کریں')).toBeOnTheScreen();
    expect(screen.getByLabelText('ایم پی ایس کنیکٹ')).toBeOnTheScreen();
    expect(screen.queryByText('Welcome to MPS Connect')).toBeNull();
    expect(screen.getByRole('button', { name: /اردو/ })).toBeSelected();
    expect(screen.getByRole('button', { name: /English/ })).not.toBeSelected();
  });

  it('puts the English box on the left and the Urdu box on the right', async () => {
    renderWelcomeScreen();
    await screen.findByText('Choose your language');

    const english = screen.getByRole('button', { name: /English/ });
    const urdu = screen.getByRole('button', { name: /اردو/ });
    const contains = (node, target) => node === target || (node.children ?? []).some((child) => typeof child !== 'string' && contains(child, target));
    let row = english.parent;
    while (row && !contains(row, urdu)) row = row.parent;
    const flexDirections = [row.props.style].flat(Infinity).filter(Boolean).map((style) => style.flexDirection);
    const childIndex = (target) => row.children.findIndex((child) => typeof child !== 'string' && contains(child, target));
    expect(flexDirections.includes('row') && childIndex(english) < childIndex(urdu)).toBe(true);
  });

  it('redirects an already-authenticated candidate to the dashboard instead of showing Welcome', async () => {
    jest.requireMock('expo-secure-store').__setRaw(
      'descon.candidateSession',
      JSON.stringify({
        accessToken: 'token',
        refreshToken: 'refresh',
        candidateId: 'candidate_1',
        candidateName: 'Ahmed Ali',
        preferredLocale: 'en',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        consent: { currentPolicyVersion: 'v1', accepted: true, acceptedAt: '2026-09-06T12:00:00Z' },
      })
    );

    renderWelcomeScreen();

    await waitFor(() => expect(screen.getByText('redirect:/(tabs)/dashboard')).toBeOnTheScreen());
    expect(screen.queryByRole('button', { name: 'Continue, جاری رکھیں' })).toBeNull();
  });
});

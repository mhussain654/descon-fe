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
    expect(await screen.findByRole('button', { name: 'Continue, جاری رکھیں' })).toBeOnTheScreen();
  });

  it('shows every piece of copy in both English and Urdu before a language is chosen', async () => {
    renderWelcomeScreen();
    expect(await screen.findByText('Choose your language')).toBeOnTheScreen();
    expect(screen.getByText('اپنی زبان منتخب کریں')).toBeOnTheScreen();
    expect(screen.getByText('“Welcome to MPS Connect, your gateway to overseas employment”')).toBeOnTheScreen();
    expect(screen.getByText('“ایم پی ایس کنیکٹ میں خوش آمدید،\nبیرونِ ملک روزگار کے لیے آپ کا راستہ”')).toBeOnTheScreen();
    expect(screen.getByText('You can change it later from your profile.')).toBeOnTheScreen();
    expect(screen.getByText('Securely managed by Descon Manpower Services')).toBeOnTheScreen();
    expect(screen.getByText('ڈیسکون مین پاور سروسز کے زیرِ انتظام، محفوظ')).toBeOnTheScreen();
    expect(screen.getByLabelText('MPS Connect')).toBeOnTheScreen();
  });

  it('shows no caption under the English and Urdu language boxes', async () => {
    renderWelcomeScreen();
    await screen.findByText('Choose your language');

    expect(screen.queryByText('Continue in English')).toBeNull();
    expect(screen.queryByText('اردو میں جاری رکھیں')).toBeNull();
  });

  it('marks the chosen language card selected', async () => {
    renderWelcomeScreen();
    await screen.findByText('Choose your language');

    const urduCard = screen.getByRole('button', { name: /اردو/ });
    expect(urduCard).not.toBeSelected();

    fireEvent.press(urduCard);

    await waitFor(() => expect(screen.getByRole('button', { name: /اردو/ })).toBeSelected());
    expect(screen.getByRole('button', { name: /English/ })).not.toBeSelected();
    // The app name stays "MPS Connect" on this bilingual screen.
    expect(screen.getByLabelText('MPS Connect')).toBeOnTheScreen();
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

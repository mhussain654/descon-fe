import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react-native';
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
  useRouter: () => ({ replace: jest.fn() }),
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
  });

  it('renders the language/continue screen once restoration finds no session', async () => {
    renderWelcomeScreen();
    expect(await screen.findByText('Continue')).toBeOnTheScreen();
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
      })
    );

    renderWelcomeScreen();

    await waitFor(() => expect(screen.getByText('redirect:/(tabs)/dashboard')).toBeOnTheScreen());
    expect(screen.queryByText('Continue')).toBeNull();
  });
});

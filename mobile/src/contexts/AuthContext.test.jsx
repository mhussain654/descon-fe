import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { AuthProvider, useAuth } from './AuthContext';

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
  };
});

function Probe() {
  const { status, session, login, logout, sessionExpired } = useAuth();
  return (
    <>
      <Text testID="status">{status}</Text>
      <Text testID="expired">{String(sessionExpired)}</Text>
      <Text testID="candidate">{session?.candidateId ?? 'none'}</Text>
      <Pressable
        testID="login"
        onPress={() =>
          login({
            accessToken: 'token',
            candidateId: 'candidate_1',
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          })
        }
      >
        <Text>login</Text>
      </Pressable>
      <Pressable
        testID="login-short"
        onPress={() =>
          login({
            accessToken: 'token',
            candidateId: 'candidate_short',
            expiresAt: new Date(Date.now() + 1000).toISOString(),
          })
        }
      >
        <Text>login-short</Text>
      </Pressable>
      <Pressable testID="logout" onPress={() => logout()}>
        <Text>logout</Text>
      </Pressable>
    </>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.requireMock('expo-secure-store').__reset();
  });

  it('starts as "restoring" and resolves to unauthenticated once the secure-store read finishes', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await screen.findByText('unauthenticated');
    expect(screen.getByTestId('candidate')).toHaveTextContent('none');
  });

  it('becomes authenticated once login() is called with a valid session', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await screen.findByText('unauthenticated');

    fireEvent.press(screen.getByTestId('login'));
    expect(screen.getByTestId('status')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('candidate')).toHaveTextContent('candidate_1');
  });

  it('persists the session to secure storage and restores it on the next mount', async () => {
    const first = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await first.findByText('unauthenticated');
    fireEvent.press(first.getByTestId('login'));
    expect(await first.findByTestId('candidate')).toHaveTextContent('candidate_1');
    first.unmount();

    const second = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    const status = await second.findByTestId('status');
    expect(status).toHaveTextContent('authenticated');
    expect(second.getByTestId('candidate')).toHaveTextContent('candidate_1');
  });

  it('clears the session (and secure storage) on manual logout', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await screen.findByText('unauthenticated');
    fireEvent.press(screen.getByTestId('login'));
    fireEvent.press(screen.getByTestId('logout'));

    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    expect(screen.getByTestId('expired')).toHaveTextContent('false');
    expect(jest.requireMock('expo-secure-store').deleteItemAsync).toHaveBeenCalled();
  });

  it('detects the session going stale while the app is open and flags it as an expiry', async () => {
    jest.useFakeTimers();
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.press(screen.getByTestId('login-short'));
    expect(screen.getByTestId('status')).toHaveTextContent('authenticated');

    act(() => {
      jest.advanceTimersByTime(6000);
    });

    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    expect(screen.getByTestId('expired')).toHaveTextContent('true');
    jest.useRealTimers();
  });
});

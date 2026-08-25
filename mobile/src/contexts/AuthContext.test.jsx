import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
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
    __setRaw: (key, value) => {
      store[key] = value;
    },
  };
});

function renderWithProviders(ui) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{ui}</AuthProvider>
      </QueryClientProvider>
    ),
    queryClient,
  };
}

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
            refreshToken: 'refresh',
            candidateId: 'candidate_1',
            candidateName: 'Ahmed Ali',
            preferredLocale: 'en',
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          }).catch(() => {})
        }
      >
        <Text>login</Text>
      </Pressable>
      <Pressable
        testID="login-short"
        onPress={() =>
          login({
            accessToken: 'token',
            refreshToken: 'refresh',
            candidateId: 'candidate_short',
            candidateName: 'Ahmed Ali',
            preferredLocale: 'en',
            expiresAt: new Date(Date.now() + 1000).toISOString(),
          }).catch(() => {})
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
    renderWithProviders(<Probe />);
    await screen.findByText('unauthenticated');
    expect(screen.getByTestId('candidate')).toHaveTextContent('none');
  });

  it('becomes authenticated once login() resolves (persistence succeeded)', async () => {
    renderWithProviders(<Probe />);
    await screen.findByText('unauthenticated');

    fireEvent.press(screen.getByTestId('login'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    expect(screen.getByTestId('candidate')).toHaveTextContent('candidate_1');
    expect(jest.requireMock('expo-secure-store').setItemAsync).toHaveBeenCalledWith(
      'descon.candidateSession',
      expect.any(String)
    );
  });

  it('persists the session to secure storage and restores it on the next mount', async () => {
    const first = renderWithProviders(<Probe />);
    await first.findByText('unauthenticated');
    fireEvent.press(first.getByTestId('login'));
    await waitFor(() => expect(first.getByTestId('status')).toHaveTextContent('authenticated'));
    first.unmount();

    const second = renderWithProviders(<Probe />);
    const status = await second.findByTestId('status');
    await waitFor(() => expect(status).toHaveTextContent('authenticated'));
    expect(second.getByTestId('candidate')).toHaveTextContent('candidate_1');
  });

  it('clears the session and secure storage on manual logout', async () => {
    renderWithProviders(<Probe />);
    await screen.findByText('unauthenticated');
    fireEvent.press(screen.getByTestId('login'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));

    fireEvent.press(screen.getByTestId('logout'));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
    expect(screen.getByTestId('expired')).toHaveTextContent('false');
    await waitFor(() =>
      expect(jest.requireMock('expo-secure-store').deleteItemAsync).toHaveBeenCalledWith('descon.candidateSession')
    );
  });

  it('clears the TanStack Query cache on logout', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const clearSpy = jest.spyOn(queryClient, 'clear');
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </QueryClientProvider>
    );
    await screen.findByText('unauthenticated');
    fireEvent.press(screen.getByTestId('login'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));

    fireEvent.press(screen.getByTestId('logout'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));

    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('detects the session going stale while the app is open and flags it as an expiry', async () => {
    jest.useFakeTimers();
    renderWithProviders(<Probe />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.press(screen.getByTestId('login-short'));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId('status')).toHaveTextContent('authenticated');

    act(() => {
      jest.advanceTimersByTime(6000);
    });

    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    expect(screen.getByTestId('expired')).toHaveTextContent('true');
    jest.useRealTimers();
  });

  it('does not restore a session on mount when the SecureStore read rejects', async () => {
    jest.requireMock('expo-secure-store').getItemAsync.mockImplementationOnce(() =>
      Promise.reject(new Error('keystore unavailable'))
    );
    renderWithProviders(<Probe />);
    await screen.findByText('unauthenticated');
    expect(screen.getByTestId('candidate')).toHaveTextContent('none');
  });

  it('deletes and ignores a malformed persisted session instead of restoring it', async () => {
    jest.requireMock('expo-secure-store').__setRaw('descon.candidateSession', 'not valid json');
    renderWithProviders(<Probe />);
    await screen.findByText('unauthenticated');
    expect(screen.getByTestId('candidate')).toHaveTextContent('none');
    await waitFor(() =>
      expect(jest.requireMock('expo-secure-store').deleteItemAsync).toHaveBeenCalledWith('descon.candidateSession')
    );
  });

  it('deletes and ignores a persisted session missing required fields instead of restoring it', async () => {
    jest.requireMock('expo-secure-store').__setRaw('descon.candidateSession', JSON.stringify({ accessToken: 'x' }));
    renderWithProviders(<Probe />);
    await screen.findByText('unauthenticated');
    expect(screen.getByTestId('candidate')).toHaveTextContent('none');
    await waitFor(() =>
      expect(jest.requireMock('expo-secure-store').deleteItemAsync).toHaveBeenCalledWith('descon.candidateSession')
    );
  });

  it('deletes and ignores a persisted session that has already expired instead of restoring it', async () => {
    jest.requireMock('expo-secure-store').__setRaw(
      'descon.candidateSession',
      JSON.stringify({
        accessToken: 'x',
        refreshToken: 'y',
        candidateId: 'y',
        candidateName: 'Ahmed Ali',
        preferredLocale: 'en',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      })
    );
    renderWithProviders(<Probe />);
    await screen.findByText('unauthenticated');
    expect(screen.getByTestId('candidate')).toHaveTextContent('none');
    await waitFor(() =>
      expect(jest.requireMock('expo-secure-store').deleteItemAsync).toHaveBeenCalledWith('descon.candidateSession')
    );
  });

  it('logs the candidate out even when SecureStore deletion fails, and overwrites the entry with an expired marker so it cannot be restored later', async () => {
    renderWithProviders(<Probe />);
    await screen.findByText('unauthenticated');
    fireEvent.press(screen.getByTestId('login'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));

    const secureStoreMock = jest.requireMock('expo-secure-store');
    secureStoreMock.deleteItemAsync.mockImplementationOnce(() => Promise.reject(new Error('keystore locked')));

    fireEvent.press(screen.getByTestId('logout'));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
    expect(screen.getByTestId('candidate')).toHaveTextContent('none');

    await waitFor(() => expect(secureStoreMock.setItemAsync).toHaveBeenCalledWith('descon.candidateSession', expect.stringContaining('"accessToken":""')));
  });

  it('rejects login() when SecureStore persistence fails, without changing status', async () => {
    renderWithProviders(<Probe />);
    await screen.findByText('unauthenticated');

    const secureStoreMock = jest.requireMock('expo-secure-store');
    secureStoreMock.setItemAsync.mockImplementationOnce(() => Promise.reject(new Error('keystore full')));

    fireEvent.press(screen.getByTestId('login'));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    expect(screen.getByTestId('candidate')).toHaveTextContent('none');
  });
});

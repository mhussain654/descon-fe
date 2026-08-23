import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { RequireAuth } from './RequireAuth';
import { useAuth } from '../../contexts/AuthContext';

jest.mock('expo-router', () => ({
  Redirect: ({ href }) => {
    const { Text: MockText } = jest.requireActual('react-native');
    return <MockText>redirect:{href}</MockText>;
  },
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key) => key }),
}));

function ProtectedStub() {
  return <Text>Protected content</Text>;
}

describe('RequireAuth', () => {
  it('shows a loading state instead of protected content while the session is restoring', () => {
    useAuth.mockReturnValue({ status: 'restoring' });
    render(
      <RequireAuth>
        <ProtectedStub />
      </RequireAuth>
    );
    expect(screen.queryByText('Protected content')).toBeNull();
    expect(screen.getByRole('progressbar')).toBeOnTheScreen();
  });

  it('redirects to /login instead of rendering protected content when unauthenticated', () => {
    useAuth.mockReturnValue({ status: 'unauthenticated' });
    render(
      <RequireAuth>
        <ProtectedStub />
      </RequireAuth>
    );
    expect(screen.queryByText('Protected content')).toBeNull();
    expect(screen.getByText('redirect:/login')).toBeOnTheScreen();
  });

  it('renders protected content once authenticated', () => {
    useAuth.mockReturnValue({ status: 'authenticated' });
    render(
      <RequireAuth>
        <ProtectedStub />
      </RequireAuth>
    );
    expect(screen.getByText('Protected content')).toBeOnTheScreen();
  });
});

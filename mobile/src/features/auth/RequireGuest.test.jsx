import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { RequireGuest } from './RequireGuest';
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

function GuestStub() {
  return <Text>Guest content</Text>;
}

describe('RequireGuest', () => {
  it('shows a loading state instead of guest content while the session is restoring', () => {
    useAuth.mockReturnValue({ status: 'restoring' });
    render(
      <RequireGuest>
        <GuestStub />
      </RequireGuest>
    );
    expect(screen.queryByText('Guest content')).toBeNull();
    expect(screen.getByRole('progressbar')).toBeOnTheScreen();
  });

  it('redirects to the authenticated dashboard instead of rendering guest content when already authenticated', () => {
    useAuth.mockReturnValue({ status: 'authenticated' });
    render(
      <RequireGuest>
        <GuestStub />
      </RequireGuest>
    );
    expect(screen.queryByText('Guest content')).toBeNull();
    expect(screen.getByText('redirect:/(tabs)/dashboard')).toBeOnTheScreen();
  });

  it('renders guest content when unauthenticated', () => {
    useAuth.mockReturnValue({ status: 'unauthenticated' });
    render(
      <RequireGuest>
        <GuestStub />
      </RequireGuest>
    );
    expect(screen.getByText('Guest content')).toBeOnTheScreen();
  });
});

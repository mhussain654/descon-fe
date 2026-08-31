import { render, screen } from '@testing-library/react-native';
import Index from './index';
import { useAuth } from '../contexts/AuthContext';

jest.mock('expo-router', () => ({
  Redirect: ({ href }) => {
    const { Text: MockText } = jest.requireActual('react-native');
    return <MockText>redirect:{href}</MockText>;
  },
}));

jest.mock('../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key) => key }),
}));

describe('root route (app entry)', () => {
  it('shows a neutral loading state, with no Welcome/Login/dashboard redirect, while the session is restoring', () => {
    useAuth.mockReturnValue({ status: 'restoring' });
    render(<Index />);

    expect(screen.queryByText(/^redirect:/)).toBeNull();
    expect(screen.getByRole('progressbar')).toBeOnTheScreen();
  });

  it('redirects straight to the authenticated dashboard when a valid session was restored', () => {
    useAuth.mockReturnValue({ status: 'authenticated' });
    render(<Index />);

    expect(screen.getByText('redirect:/(tabs)/dashboard')).toBeOnTheScreen();
  });

  it('redirects to Welcome when no session exists (or it was removed as expired/malformed)', () => {
    useAuth.mockReturnValue({ status: 'unauthenticated' });
    render(<Index />);

    expect(screen.getByText('redirect:/welcome')).toBeOnTheScreen();
  });
});

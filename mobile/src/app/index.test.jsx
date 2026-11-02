import { render, screen } from '@testing-library/react-native';
import { takeLanguageResumeRoute } from '../contexts/LanguageContext';
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
  takeLanguageResumeRoute: jest.fn(),
}));

beforeEach(() => {
  takeLanguageResumeRoute.mockResolvedValue(null);
});

describe('root route (app entry)', () => {
  it('shows a neutral loading state, with no Welcome/Login/dashboard redirect, while the session is restoring', () => {
    useAuth.mockReturnValue({ status: 'restoring' });
    render(<Index />);

    expect(screen.queryByText(/^redirect:/)).toBeNull();
    expect(screen.getByRole('progressbar')).toBeOnTheScreen();
  });

  it('redirects straight to the authenticated dashboard when a valid session was restored', async () => {
    useAuth.mockReturnValue({ status: 'authenticated' });
    render(<Index />);

    expect(await screen.findByText('redirect:/(tabs)/dashboard')).toBeOnTheScreen();
  });

  it('redirects to Welcome when no session exists (or it was removed as expired/malformed)', async () => {
    useAuth.mockReturnValue({ status: 'unauthenticated' });
    render(<Index />);

    expect(await screen.findByText('redirect:/welcome')).toBeOnTheScreen();
  });

  it('reopens sign-in, not the language page, after a language switch on the sign-in screen reloaded the app', async () => {
    takeLanguageResumeRoute.mockResolvedValue('/login');
    useAuth.mockReturnValue({ status: 'unauthenticated' });
    render(<Index />);

    expect(await screen.findByText('redirect:/login')).toBeOnTheScreen();
  });

  it('reopens Profile for a signed-in candidate who switched language there', async () => {
    takeLanguageResumeRoute.mockResolvedValue('/(tabs)/profile');
    useAuth.mockReturnValue({ status: 'authenticated' });
    render(<Index />);

    expect(await screen.findByText('redirect:/(tabs)/profile')).toBeOnTheScreen();
  });
});

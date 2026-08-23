import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthProvider } from '../../contexts/AuthContext';
import { LanguageProvider } from '../../contexts/LanguageContext';
import LoginPage from './page';

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('dir');
  document.documentElement.removeAttribute('lang');
});

function renderLoginPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('LoginPage', () => {
  it('contains exactly one user-input field: CNIC -- no mobile number, email or password', () => {
    renderLoginPage();
    const textboxes = screen.getAllByRole('textbox');
    expect(textboxes).toHaveLength(1);
    expect(textboxes[0]).toHaveAccessibleName(/cnic/i);

    expect(screen.queryByRole('textbox', { name: /mobile/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  });

  it('never renders any signup/registration affordance', () => {
    renderLoginPage();
    expect(screen.queryByText(/sign up/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/register/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/create an account/i)).not.toBeInTheDocument();
  });

  it('shows a required-field error for an empty CNIC submission', () => {
    renderLoginPage();
    fireEvent.click(screen.getByRole('button', { name: 'Send OTP' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your CNIC to continue.');
  });

  it('shows a format error for a too-short CNIC', () => {
    renderLoginPage();
    fireEvent.change(screen.getByLabelText('CNIC Number'), { target: { value: '12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send OTP' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid 13-digit CNIC.');
  });

  it('moves to the OTP step, showing only the OTP field, after a valid CNIC submission', async () => {
    renderLoginPage();
    fireEvent.change(screen.getByLabelText('CNIC Number'), { target: { value: '1234512345671' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send OTP' }));

    await waitFor(() => expect(screen.getByLabelText('One-Time Password')).toBeInTheDocument());
    expect(screen.queryByLabelText('CNIC Number')).not.toBeInTheDocument();
  });

  it('renders in Urdu/RTL when that is the persisted language, with the CNIC field still forced left-to-right', () => {
    window.localStorage.setItem('descon.language', 'ur');
    renderLoginPage();

    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ur');
    const input = screen.getByLabelText('شناختی کارڈ نمبر');
    expect(input).toHaveAttribute('placeholder', 'اپنا شناختی کارڈ نمبر درج کریں');
    expect(input).toHaveAttribute('dir', 'ltr');

    fireEvent.click(screen.getByRole('button', { name: 'او ٹی پی بھیجیں' }));
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('جاری رکھنے کے لیے اپنا شناختی کارڈ نمبر درج کریں۔');
    expect(alert.className).not.toMatch(/truncate|overflow-hidden/);
  });
});

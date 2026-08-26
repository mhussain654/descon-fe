import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../../contexts/AuthContext';
import { LanguageProvider } from '../../contexts/LanguageContext';
import { candidateAuthClient } from '../../lib/auth-client';
import LoginPage from './page';

// login/page.jsx submits through the real, module-level `candidateAuthClient`
// singleton (../../lib/auth-client.ts), so the actual OTP network calls are
// mocked at the fetch boundary here, per AGENTS.md: "Mock the centralized
// API boundary ... Do not call live backend or provider services from
// unit/component tests." Individual tests below still use
// `vi.spyOn(candidateAuthClient, ...).mockRejectedValueOnce(...)` to inject
// a specific error for one call -- that takes precedence over this default
// success stub since it replaces the client method itself.
const originalFetch = globalThis.fetch;

function successEnvelope(data) {
  return { data, meta: {}, errors: [] };
}

beforeEach(() => {
  globalThis.fetch = vi.fn(async (url) => {
    if (String(url).includes('/candidate/auth/otp/verify')) {
      return new Response(
        JSON.stringify(
          successEnvelope({
            access_token: 'access-1',
            refresh_token: 'refresh-1',
            token_type: 'Bearer',
            expires_in: 900,
            session: { id: 'session-1' },
            candidate: { id: 'candidate-1', full_name: 'Test Candidate', preferred_locale: 'en' },
          })
        ),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (String(url).includes('/candidate/auth/otp/request')) {
      return new Response(
        JSON.stringify(successEnvelope({ expires_in_seconds: 300, resend_after_seconds: 30 })),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    throw new Error(`login/page.test.jsx: unexpected fetch to ${url}`);
  });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
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

  describe('server-enforced rate limiting (Retry-After)', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('shows a live countdown and disables Send OTP after the CNIC step is rate-limited', async () => {
      vi.spyOn(candidateAuthClient, 'requestOtp').mockRejectedValueOnce({
        code: 'RATE_LIMITED',
        retryAfterSeconds: 30,
      });
      renderLoginPage();

      fireEvent.change(screen.getByLabelText('CNIC Number'), { target: { value: '1234512345671' } });
      fireEvent.click(screen.getByRole('button', { name: 'Send OTP' }));

      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('You can try again in 0:30'));
      expect(screen.getByRole('button', { name: 'Send OTP' })).toBeDisabled();
    });

    it('shows a live countdown and disables Verify after OTP verification is rate-limited', async () => {
      renderLoginPage();
      fireEvent.change(screen.getByLabelText('CNIC Number'), { target: { value: '1234512345671' } });
      fireEvent.click(screen.getByRole('button', { name: 'Send OTP' }));
      await waitFor(() => expect(screen.getByLabelText('One-Time Password')).toBeInTheDocument());

      vi.spyOn(candidateAuthClient, 'verifyOtp').mockRejectedValueOnce({
        code: 'RATE_LIMITED',
        retryAfterSeconds: 20,
      });
      fireEvent.change(screen.getByLabelText('One-Time Password'), { target: { value: '123456' } });
      fireEvent.click(screen.getByRole('button', { name: 'Verify & Login' }));

      await waitFor(() => expect(screen.getByText('You can try again in 0:20')).toBeInTheDocument());
      expect(screen.getByRole('button', { name: 'Verify & Login' })).toBeDisabled();
    });

    it('shows a live countdown after a resend is rate-limited, independent of the Verify action', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        renderLoginPage();
        fireEvent.change(screen.getByLabelText('CNIC Number'), { target: { value: '1234512345671' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send OTP' }));
        await waitFor(() => expect(screen.getByLabelText('One-Time Password')).toBeInTheDocument());

        // The challenge's own resend cooldown (MOCK_RESEND_AFTER_SECONDS) must
        // clear before the real "Resend OTP" button renders at all.
        await act(async () => {
          await vi.advanceTimersByTimeAsync(31_000);
        });

        vi.spyOn(candidateAuthClient, 'resendOtp').mockRejectedValueOnce({
          code: 'RATE_LIMITED',
          retryAfterSeconds: 12,
        });
        fireEvent.click(screen.getByRole('button', { name: 'Resend OTP' }));

        await waitFor(() => expect(screen.getAllByText('You can resend in 0:12').length).toBeGreaterThan(0));
        // This is the resend-scoped cooldown wording, not the verify-scoped
        // "You can try again in" copy -- the two rate limits render distinct
        // messages (see the useCnicOtpFlow hook tests for the corresponding
        // "verify still callable while resend is rate-limited" behavior).
        expect(screen.queryByText(/You can try again in/)).not.toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });

    it('shows the CNIC-step countdown in Urdu', async () => {
      window.localStorage.setItem('descon.language', 'ur');
      vi.spyOn(candidateAuthClient, 'requestOtp').mockRejectedValueOnce({
        code: 'RATE_LIMITED',
        retryAfterSeconds: 30,
      });
      renderLoginPage();

      fireEvent.change(screen.getByLabelText('شناختی کارڈ نمبر'), { target: { value: '1234512345671' } });
      fireEvent.click(screen.getByRole('button', { name: 'او ٹی پی بھیجیں' }));

      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent('آپ دوبارہ کوشش کر سکیں گے 0:30')
      );
      expect(screen.getByRole('button', { name: 'او ٹی پی بھیجیں' })).toBeDisabled();
    });
  });
});

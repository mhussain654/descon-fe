// Exercises the shared hook (shared/auth/useCnicOtpFlow.ts) through mobile's
// own testing library. Web has an equivalent test using
// @testing-library/react's renderHook -- the hook implementation itself
// lives once in shared/, only the render harness differs per platform.
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { createMockCandidateAuthClient, MOCK_VALID_OTP } from '../../../../shared/auth/candidateAuthClient';
import type { AuthSession } from '../../../../shared/auth/types';
import { useCnicOtpFlow } from '../../../../shared/auth/useCnicOtpFlow';

const CNIC = '1234512345671';

function setUp(onAuthenticated = jest.fn()) {
  const client = createMockCandidateAuthClient({ delayMs: 0 });
  const { result } = renderHook(() => useCnicOtpFlow({ client, onAuthenticated }));
  return { result, onAuthenticated };
}

describe('useCnicOtpFlow', () => {
  it('rejects an empty CNIC as required, without calling the client', async () => {
    const { result } = setUp();
    await act(async () => {
      await result.current.submitCnic();
    });
    expect(result.current.cnicError).toBe('REQUIRED');
    expect(result.current.step).toBe('cnic');
  });

  it('rejects a too-short CNIC as an invalid format', async () => {
    const { result } = setUp();
    act(() => result.current.setCnic('123'));
    await act(async () => {
      await result.current.submitCnic();
    });
    expect(result.current.cnicError).toBe('INVALID_FORMAT');
  });

  it('moves to the OTP step and calls onAuthenticated once the correct code is verified', async () => {
    const onAuthenticated = jest.fn();
    const { result } = setUp(onAuthenticated);

    act(() => result.current.setCnic(CNIC));
    await act(async () => {
      await result.current.submitCnic();
    });
    expect(result.current.step).toBe('otp');
    expect(result.current.challenge).not.toBeNull();

    act(() => result.current.setOtp(MOCK_VALID_OTP));
    await act(async () => {
      await result.current.submitOtp();
    });

    expect(onAuthenticated).toHaveBeenCalledTimes(1);
    expect(onAuthenticated.mock.calls[0][0].candidateId).toEqual(expect.any(String));
  });

  it('verifies the code passed explicitly to submitOtp, not stale otp state (regression: onComplete fires before React re-renders the typed digit)', async () => {
    const client = createMockCandidateAuthClient({ delayMs: 0 });
    const verifyOtpSpy = jest.spyOn(client, 'verifyOtp');
    const onAuthenticated = jest.fn();
    const { result } = renderHook(() => useCnicOtpFlow({ client, onAuthenticated }));

    act(() => result.current.setCnic(CNIC));
    await act(async () => {
      await result.current.submitCnic();
    });

    // `otp` state is still '' here -- submitOtp must use the override, not it.
    await act(async () => {
      await result.current.submitOtp(MOCK_VALID_OTP);
    });

    expect(verifyOtpSpy).toHaveBeenCalledWith(expect.any(String), MOCK_VALID_OTP);
    expect(onAuthenticated).toHaveBeenCalledTimes(1);
  });

  it('does not submit an incomplete code, whether from state or an override', async () => {
    const client = createMockCandidateAuthClient({ delayMs: 0 });
    const verifyOtpSpy = jest.spyOn(client, 'verifyOtp');
    const { result } = renderHook(() => useCnicOtpFlow({ client, onAuthenticated: jest.fn() }));

    act(() => result.current.setCnic(CNIC));
    await act(async () => {
      await result.current.submitCnic();
    });

    act(() => result.current.setOtp('123'));
    await act(async () => {
      await result.current.submitOtp();
    });
    await act(async () => {
      await result.current.submitOtp('12345');
    });

    expect(verifyOtpSpy).not.toHaveBeenCalled();
  });

  it('surfaces an invalid-code error and clears the OTP field', async () => {
    const { result } = setUp();
    act(() => result.current.setCnic(CNIC));
    await act(async () => {
      await result.current.submitCnic();
    });

    act(() => result.current.setOtp('000000'));
    await act(async () => {
      await result.current.submitOtp();
    });

    expect(result.current.otpError).toEqual({ code: 'OTP_INVALID' });
    expect(result.current.otp).toBe('');
  });

  it('exposes a live expiry countdown once a challenge exists', async () => {
    const { result } = setUp();
    act(() => result.current.setCnic(CNIC));
    await act(async () => {
      await result.current.submitCnic();
    });

    expect(result.current.secondsUntilExpiry).toBeGreaterThan(0);

    await waitFor(
      () => {
        expect(result.current.secondsUntilExpiry).toBeLessThan(result.current.challenge!.expiresInSeconds);
      },
      { timeout: 2000 }
    );
  });

  it('resets to the CNIC step, keeping the entered CNIC, when going back', async () => {
    const { result } = setUp();
    act(() => result.current.setCnic(CNIC));
    await act(async () => {
      await result.current.submitCnic();
    });

    act(() => result.current.backToCnic());
    expect(result.current.step).toBe('cnic');
    expect(result.current.cnic).toBe(CNIC);
    expect(result.current.challenge).toBeNull();
  });

  it('ignores a stale verifyOtp response that resolves after the candidate has already gone back to CNIC entry', async () => {
    let resolveVerify: (value: AuthSession) => void;
    const client = createMockCandidateAuthClient({ delayMs: 0 });
    const realVerify = client.verifyOtp.bind(client);
    client.verifyOtp = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveVerify = resolve;
        })
    ) as typeof client.verifyOtp;
    const onAuthenticated = jest.fn();
    const { result } = renderHook(() => useCnicOtpFlow({ client, onAuthenticated }));

    act(() => result.current.setCnic(CNIC));
    await act(async () => {
      await result.current.submitCnic();
    });
    act(() => result.current.setOtp(MOCK_VALID_OTP));

    let submitPromise: Promise<void>;
    act(() => {
      submitPromise = result.current.submitOtp();
    });
    expect(result.current.isSubmittingOtp).toBe(true);

    // The candidate navigates back before the (still in-flight) verify
    // resolves -- this must invalidate that in-flight request.
    act(() => result.current.backToCnic());
    expect(result.current.step).toBe('cnic');

    const staleSession = await realVerify(CNIC, MOCK_VALID_OTP);
    await act(async () => {
      resolveVerify(staleSession);
      await submitPromise;
    });

    // The stale response must not have re-authenticated or moved the
    // screen back to the OTP step.
    expect(onAuthenticated).not.toHaveBeenCalled();
    expect(result.current.step).toBe('cnic');
  });
});

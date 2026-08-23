// Exercises the shared hook (shared/auth/useCnicOtpFlow.ts) through web's own
// testing library. Mobile has an equivalent test using React Native Testing
// Library's renderHook -- the hook implementation itself lives once in
// shared/, only the render harness differs per platform.
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createMockCandidateAuthClient, MOCK_VALID_OTP } from '../../../../shared/auth/candidateAuthClient';
import { useCnicOtpFlow } from '../../../../shared/auth/useCnicOtpFlow';

const CNIC = '1234512345671';

function setUp(onAuthenticated = vi.fn()) {
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
    const onAuthenticated = vi.fn();
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
});

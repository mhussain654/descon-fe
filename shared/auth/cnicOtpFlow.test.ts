// Framework-agnostic: runs under both web's Vitest and mobile's Jest.
import {
  cnicOtpReducer,
  createInitialCnicOtpState,
  formatCountdown,
  secondsUntilExpiry,
  secondsUntilRateLimitCleared,
  secondsUntilResendAvailable,
} from './cnicOtpFlow';
import type { OtpChallenge } from './types';

const challenge: OtpChallenge = {
  expiresInSeconds: 120,
  resendAfterSeconds: 30,
  maskedDestination: '••• ••• ••34',
};

describe('cnicOtpReducer', () => {
  it('starts on the CNIC step with an empty, untouched form', () => {
    const state = createInitialCnicOtpState(1000);
    expect(state.step).toBe('cnic');
    expect(state.cnic).toBe('');
    expect(state.challenge).toBeNull();
  });

  it('tracks CNIC field edits and clears any prior error', () => {
    let state = createInitialCnicOtpState(0);
    state = cnicOtpReducer(state, { type: 'CNIC_SUBMIT_FAILED', error: 'REQUIRED', now: 0 });
    expect(state.cnicError).toBe('REQUIRED');

    state = cnicOtpReducer(state, { type: 'CNIC_CHANGED', cnic: '123' });
    expect(state.cnic).toBe('123');
    expect(state.cnicError).toBeNull();
  });

  it('moves to the OTP step on a successful CNIC submission, seeding the challenge', () => {
    let state = createInitialCnicOtpState(0);
    state = cnicOtpReducer(state, { type: 'CNIC_SUBMIT_STARTED' });
    expect(state.isSubmittingCnic).toBe(true);

    state = cnicOtpReducer(state, { type: 'CNIC_SUBMIT_SUCCEEDED', challenge, now: 1000 });
    expect(state.step).toBe('otp');
    expect(state.isSubmittingCnic).toBe(false);
    expect(state.challenge).toEqual(challenge);
    expect(state.otp).toBe('');
  });

  it('routes a generic (non-enumerating) request failure to otpError, not a CNIC field error', () => {
    let state = createInitialCnicOtpState(0);
    state = cnicOtpReducer(state, {
      type: 'CNIC_SUBMIT_FAILED',
      error: { code: 'OTP_REQUEST_FAILED' },
      now: 0,
    });
    expect(state.cnicError).toBeNull();
    expect(state.otpError).toEqual({ code: 'OTP_REQUEST_FAILED' });
    expect(state.step).toBe('cnic');
  });

  describe('once on the OTP step', () => {
    function otpStepState() {
      let state = createInitialCnicOtpState(0);
      state = cnicOtpReducer(state, { type: 'CNIC_SUBMIT_SUCCEEDED', challenge, now: 1000 });
      state = cnicOtpReducer(state, { type: 'OTP_CHANGED', otp: '111111' });
      return state;
    }

    it('clears the OTP value after an invalid-code failure', () => {
      let state = otpStepState();
      state = cnicOtpReducer(state, { type: 'OTP_SUBMIT_FAILED', error: { code: 'OTP_INVALID' }, now: 0 });
      expect(state.otp).toBe('');
      expect(state.otpError).toEqual({ code: 'OTP_INVALID' });
    });

    it('clears the OTP value after an expiry failure', () => {
      let state = otpStepState();
      state = cnicOtpReducer(state, { type: 'OTP_SUBMIT_FAILED', error: { code: 'OTP_EXPIRED' }, now: 0 });
      expect(state.otp).toBe('');
    });

    it('clears the OTP value after a too-many-attempts failure', () => {
      let state = otpStepState();
      state = cnicOtpReducer(state, { type: 'OTP_SUBMIT_FAILED', error: { code: 'OTP_MAX_ATTEMPTS' }, now: 0 });
      expect(state.otp).toBe('');
    });

    it('does not clear the OTP value for an offline/network failure -- the candidate should just be able to retry', () => {
      let state = otpStepState();
      state = cnicOtpReducer(state, { type: 'OTP_SUBMIT_FAILED', error: { code: 'OFFLINE' }, now: 0 });
      expect(state.otp).toBe('111111');
    });

    it('resets all the way back to CNIC entry when the challenge itself is gone (session expired)', () => {
      let state = otpStepState();
      state = cnicOtpReducer(state, { type: 'OTP_SUBMIT_FAILED', error: { code: 'CHALLENGE_NOT_FOUND' }, now: 0 });
      expect(state.step).toBe('cnic');
      expect(state.challenge).toBeNull();
      expect(state.otpError).toEqual({ code: 'CHALLENGE_NOT_FOUND' });
    });

    it('replaces the challenge and resets the OTP value on a successful resend', () => {
      let state = otpStepState();
      const nextChallenge: OtpChallenge = { ...challenge, expiresInSeconds: 90 };
      state = cnicOtpReducer(state, { type: 'RESEND_SUCCEEDED', challenge: nextChallenge, now: 5000 });
      expect(state.challenge).toEqual(nextChallenge);
      expect(state.issuedAt).toBe(5000);
      expect(state.otp).toBe('');
    });

    it('surfaces a resend cooldown error with its retry-after seconds', () => {
      let state = otpStepState();
      state = cnicOtpReducer(state, {
        type: 'RESEND_FAILED',
        error: { code: 'RESEND_COOLDOWN', retryAfterSeconds: 17 },
        now: 0,
      });
      expect(state.otpError).toEqual({ code: 'RESEND_COOLDOWN', retryAfterSeconds: 17 });
    });

    it('keeps the CNIC value but discards the challenge/OTP when the candidate goes back to change it', () => {
      let state = otpStepState();
      state = cnicOtpReducer(state, { type: 'BACK_TO_CNIC' });
      expect(state.step).toBe('cnic');
      expect(state.cnic).toBe('');
      expect(state.challenge).toBeNull();
    });

    it('keeps an already-entered CNIC value when going back', () => {
      let state = createInitialCnicOtpState(0);
      state = cnicOtpReducer(state, { type: 'CNIC_CHANGED', cnic: '1234512345671' });
      state = cnicOtpReducer(state, { type: 'CNIC_SUBMIT_SUCCEEDED', challenge, now: 1000 });
      state = cnicOtpReducer(state, { type: 'BACK_TO_CNIC' });
      expect(state.cnic).toBe('1234512345671');
    });
  });
});

describe('secondsUntilExpiry / secondsUntilResendAvailable', () => {
  it('returns null before any challenge exists', () => {
    const state = createInitialCnicOtpState(0);
    expect(secondsUntilExpiry(state)).toBeNull();
    expect(secondsUntilResendAvailable(state)).toBeNull();
  });

  it('counts down from the server-declared durations as time (TICK) advances', () => {
    let state = createInitialCnicOtpState(0);
    state = cnicOtpReducer(state, { type: 'CNIC_SUBMIT_SUCCEEDED', challenge, now: 0 });
    expect(secondsUntilExpiry(state)).toBe(120);
    expect(secondsUntilResendAvailable(state)).toBe(30);

    state = cnicOtpReducer(state, { type: 'TICK', now: 10_000 });
    expect(secondsUntilExpiry(state)).toBe(110);
    expect(secondsUntilResendAvailable(state)).toBe(20);
  });

  it('floors both countdowns at 0 rather than going negative', () => {
    let state = createInitialCnicOtpState(0);
    state = cnicOtpReducer(state, { type: 'CNIC_SUBMIT_SUCCEEDED', challenge, now: 0 });
    state = cnicOtpReducer(state, { type: 'TICK', now: 999_000 });
    expect(secondsUntilExpiry(state)).toBe(0);
    expect(secondsUntilResendAvailable(state)).toBe(0);
  });
});

describe('server-enforced rate limiting (RATE_LIMITED / Retry-After)', () => {
  it('records which action was rate-limited and until when, from the CNIC step', () => {
    let state = createInitialCnicOtpState(0);
    state = cnicOtpReducer(state, {
      type: 'CNIC_SUBMIT_FAILED',
      error: { code: 'RATE_LIMITED', retryAfterSeconds: 30 },
      now: 1000,
    });
    expect(state.rateLimitedAction).toBe('cnic');
    expect(state.rateLimitedUntil).toBe(31_000);
    expect(secondsUntilRateLimitCleared(state)).toBe(30);
  });

  it('records a rate limit hit while verifying the OTP, distinct from the CNIC/resend cases', () => {
    let state = createInitialCnicOtpState(0);
    state = cnicOtpReducer(state, { type: 'CNIC_SUBMIT_SUCCEEDED', challenge, now: 0 });
    state = cnicOtpReducer(state, {
      type: 'OTP_SUBMIT_FAILED',
      error: { code: 'RATE_LIMITED', retryAfterSeconds: 45 },
      now: 2000,
    });
    expect(state.rateLimitedAction).toBe('otp');
    expect(state.rateLimitedUntil).toBe(47_000);
  });

  it('records a rate limit hit while resending, distinct from the CNIC/verify cases', () => {
    let state = createInitialCnicOtpState(0);
    state = cnicOtpReducer(state, { type: 'CNIC_SUBMIT_SUCCEEDED', challenge, now: 0 });
    state = cnicOtpReducer(state, {
      type: 'RESEND_FAILED',
      error: { code: 'RATE_LIMITED', retryAfterSeconds: 15 },
      now: 3000,
    });
    expect(state.rateLimitedAction).toBe('resend');
    expect(state.rateLimitedUntil).toBe(18_000);
  });

  it('counts the rate limit down to 0 as TICK advances, then clears it entirely once past', () => {
    let state = createInitialCnicOtpState(0);
    state = cnicOtpReducer(state, {
      type: 'CNIC_SUBMIT_FAILED',
      error: { code: 'RATE_LIMITED', retryAfterSeconds: 10 },
      now: 0,
    });
    expect(secondsUntilRateLimitCleared(state)).toBe(10);

    state = cnicOtpReducer(state, { type: 'TICK', now: 6000 });
    expect(secondsUntilRateLimitCleared(state)).toBe(4);

    state = cnicOtpReducer(state, { type: 'TICK', now: 10_000 });
    expect(state.rateLimitedAction).toBeNull();
    expect(state.rateLimitedUntil).toBeNull();
    expect(secondsUntilRateLimitCleared(state)).toBeNull();
  });

  it('leaves any other failure (not RATE_LIMITED) without touching rate-limit state', () => {
    let state = createInitialCnicOtpState(0);
    state = cnicOtpReducer(state, { type: 'CNIC_SUBMIT_FAILED', error: { code: 'OTP_REQUEST_FAILED' }, now: 0 });
    expect(state.rateLimitedAction).toBeNull();
    expect(secondsUntilRateLimitCleared(state)).toBeNull();
  });
});

describe('formatCountdown', () => {
  it('formats as M:SS with a zero-padded seconds component', () => {
    expect(formatCountdown(125)).toBe('2:05');
    expect(formatCountdown(9)).toBe('0:09');
    expect(formatCountdown(60)).toBe('1:00');
  });

  it('clamps negative input to 0:00', () => {
    expect(formatCountdown(-5)).toBe('0:00');
  });
});

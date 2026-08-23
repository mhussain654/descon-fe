// Pure state machine for the CNIC -> OTP login flow (MPS-F201). No React,
// no platform APIs -- fully unit-testable, and reused as-is by the
// `useCnicOtpFlow` hook in this same directory (which both web and mobile
// import directly, since it too has no DOM/RN dependency).
import type { AuthError, OtpChallenge } from './types';

export type CnicFieldError = 'REQUIRED' | 'INVALID_FORMAT';

export type CnicOtpStep = 'cnic' | 'otp';

export interface CnicOtpState {
  step: CnicOtpStep;
  cnic: string;
  cnicError: CnicFieldError | null;
  isSubmittingCnic: boolean;

  challenge: OtpChallenge | null;
  /** Wall-clock ms when the current challenge was (re)issued -- countdown math is `now - issuedAt`, never a frontend-owned duration. */
  issuedAt: number | null;
  otp: string;
  otpError: AuthError | null;
  isSubmittingOtp: boolean;
  isResending: boolean;

  /** Ticked forward by dispatching TICK; drives countdown display without storing derived state. */
  now: number;
}

export type CnicOtpAction =
  | { type: 'CNIC_CHANGED'; cnic: string }
  | { type: 'CNIC_SUBMIT_STARTED' }
  | { type: 'CNIC_SUBMIT_FAILED'; error: CnicFieldError | AuthError }
  | { type: 'CNIC_SUBMIT_SUCCEEDED'; challenge: OtpChallenge; now: number }
  | { type: 'OTP_CHANGED'; otp: string }
  | { type: 'OTP_SUBMIT_STARTED' }
  | { type: 'OTP_SUBMIT_FAILED'; error: AuthError }
  | { type: 'RESEND_STARTED' }
  | { type: 'RESEND_FAILED'; error: AuthError }
  | { type: 'RESEND_SUCCEEDED'; challenge: OtpChallenge; now: number }
  | { type: 'BACK_TO_CNIC' }
  | { type: 'TICK'; now: number };

export function createInitialCnicOtpState(now: number = Date.now()): CnicOtpState {
  return {
    step: 'cnic',
    cnic: '',
    cnicError: null,
    isSubmittingCnic: false,
    challenge: null,
    issuedAt: null,
    otp: '',
    otpError: null,
    isSubmittingOtp: false,
    isResending: false,
    now,
  };
}

/** OTP-side errors that mean the code the candidate is holding is no longer usable -- clear it rather than leave a stale/wrong value sitting in the field (AGENTS.md: "Clear OTP after relevant failures"). */
const OTP_CLEARING_ERRORS = new Set(['OTP_INVALID', 'OTP_EXPIRED', 'OTP_MAX_ATTEMPTS']);

export function cnicOtpReducer(state: CnicOtpState, action: CnicOtpAction): CnicOtpState {
  switch (action.type) {
    case 'CNIC_CHANGED':
      return { ...state, cnic: action.cnic, cnicError: null };

    case 'CNIC_SUBMIT_STARTED':
      return { ...state, isSubmittingCnic: true, cnicError: null };

    case 'CNIC_SUBMIT_FAILED':
      return {
        ...state,
        isSubmittingCnic: false,
        cnicError: typeof action.error === 'string' ? action.error : null,
        // A non-format failure (the generic, non-enumerating OTP_REQUEST_FAILED)
        // isn't a *field* error -- surface it the same way OTP-step errors are.
        otpError: typeof action.error === 'string' ? null : action.error,
      };

    case 'CNIC_SUBMIT_SUCCEEDED':
      return {
        ...state,
        isSubmittingCnic: false,
        step: 'otp',
        challenge: action.challenge,
        issuedAt: action.now,
        now: action.now,
        otp: '',
        otpError: null,
      };

    case 'OTP_CHANGED':
      return { ...state, otp: action.otp, otpError: null };

    case 'OTP_SUBMIT_STARTED':
      return { ...state, isSubmittingOtp: true, otpError: null };

    case 'OTP_SUBMIT_FAILED': {
      // The challenge itself is gone (expired past cleanup, or the backend
      // never heard of it) -- there is nothing left to retry against, so
      // send the candidate back to re-enter their CNIC and start over.
      if (action.error.code === 'CHALLENGE_NOT_FOUND') {
        return {
          ...createInitialCnicOtpState(state.now),
          cnic: state.cnic,
          otpError: action.error,
        };
      }
      return {
        ...state,
        isSubmittingOtp: false,
        otpError: action.error,
        otp: OTP_CLEARING_ERRORS.has(action.error.code) ? '' : state.otp,
      };
    }

    case 'RESEND_STARTED':
      return { ...state, isResending: true, otpError: null };

    case 'RESEND_FAILED':
      return { ...state, isResending: false, otpError: action.error };

    case 'RESEND_SUCCEEDED':
      return {
        ...state,
        isResending: false,
        challenge: action.challenge,
        issuedAt: action.now,
        now: action.now,
        otp: '',
        otpError: null,
      };

    case 'BACK_TO_CNIC':
      return { ...createInitialCnicOtpState(state.now), cnic: state.cnic };

    case 'TICK':
      return { ...state, now: action.now };

    default:
      return state;
  }
}

/** Seconds remaining until the current challenge's OTP expires, floored at 0. Null when there's no active challenge. */
export function secondsUntilExpiry(state: CnicOtpState): number | null {
  if (!state.challenge || state.issuedAt === null) return null;
  const elapsedSeconds = (state.now - state.issuedAt) / 1000;
  return Math.max(0, Math.ceil(state.challenge.expiresInSeconds - elapsedSeconds));
}

/** Seconds remaining until resend becomes available, floored at 0. */
export function secondsUntilResendAvailable(state: CnicOtpState): number | null {
  if (!state.challenge || state.issuedAt === null) return null;
  const elapsedSeconds = (state.now - state.issuedAt) / 1000;
  return Math.max(0, Math.ceil(state.challenge.resendAfterSeconds - elapsedSeconds));
}

/** Formats a countdown as `M:SS`. Digits read the same in English and Urdu layouts, so this needs no locale-specific wording. */
export function formatCountdown(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const minutes = Math.floor(clamped / 60);
  const seconds = Math.floor(clamped % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

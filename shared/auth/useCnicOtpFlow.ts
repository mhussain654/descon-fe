// Shared React hook driving the CNIC -> OTP login flow (MPS-F201). Pure
// React + `setInterval`/`clearInterval` only -- no DOM, no React Native API
// -- so both web and mobile screens import this exact file directly rather
// than each re-implementing the same orchestration.
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { isValidCnic, toCnicDigits } from '../cnic';
import {
  type CnicOtpState,
  cnicOtpReducer,
  createInitialCnicOtpState,
  secondsUntilExpiry,
  secondsUntilRateLimitCleared,
  secondsUntilResendAvailable,
} from './cnicOtpFlow';
import { OTP_LENGTH, type AuthError, type AuthSession, type CandidateAuthClient } from './types';

function toAuthError(error: unknown): AuthError {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  ) {
    return error as AuthError;
  }
  return { code: 'UNKNOWN' };
}

export interface UseCnicOtpFlowOptions {
  client: CandidateAuthClient;
  /** Called once verification succeeds; owns persisting the session (platform-specific secure storage) and navigation. */
  onAuthenticated: (session: AuthSession) => void | Promise<void>;
}

export interface UseCnicOtpFlowResult extends CnicOtpState {
  secondsUntilExpiry: number | null;
  secondsUntilResendAvailable: number | null;
  secondsUntilRateLimitCleared: number | null;
  setCnic: (raw: string) => void;
  submitCnic: () => Promise<void>;
  setOtp: (raw: string) => void;
  /** Verifies `codeOverride` when given, else the current `otp` state. Always pass the just-completed code explicitly from an `onComplete` callback -- `state.otp` may not have re-rendered yet (React state updates aren't synchronous), so relying on it there can submit a stale, incomplete code. */
  submitOtp: (codeOverride?: string) => Promise<void>;
  resendOtp: () => Promise<void>;
  backToCnic: () => void;
}

export function useCnicOtpFlow({ client, onAuthenticated }: UseCnicOtpFlowOptions): UseCnicOtpFlowResult {
  const [state, dispatch] = useReducer(cnicOtpReducer, undefined, () => createInitialCnicOtpState());

  // Guards against a stale in-flight request (e.g. a slow resend still
  // pending when the candidate has already gone back to CNIC entry, or a
  // rapid double-submit) from applying its result to a screen it no longer
  // corresponds to. Every mutating action captures the *current* generation
  // before awaiting the network call and checks it's still current before
  // dispatching -- `backToCnic` (and unmount) bump it, invalidating anything
  // still in flight (AGENTS.md: "Cancel or ignore stale requests where
  // navigation ... can cause races").
  const generationRef = useRef(0);
  useEffect(() => () => {
    generationRef.current += 1;
  }, []);

  // Synchronous re-entrancy guards. `state.isSubmittingCnic` etc. are only
  // updated on the next render, so two calls made in the same tick (a
  // double-tap, or `onComplete` firing again before a disabled prop applies)
  // would both see the old `false` and both call the client. These refs are
  // set before the first `await` and cleared in `finally`, so the second
  // call in the same tick sees `true` immediately (AGENTS.md: "Prevent
  // accidental duplicate mutations").
  const isSubmittingCnicRef = useRef(false);
  const isSubmittingOtpRef = useRef(false);
  const isResendingRef = useRef(false);

  // Keeps the expiry/resend/rate-limit countdowns live while there's an
  // outstanding challenge or an active server-enforced rate limit (the
  // latter can be hit from the CNIC step too, not only the OTP step).
  useEffect(() => {
    if (state.step !== 'otp' && state.rateLimitedUntil === null) return undefined;
    const interval = setInterval(() => dispatch({ type: 'TICK', now: Date.now() }), 1000);
    return () => clearInterval(interval);
  }, [state.step, state.rateLimitedUntil]);

  const setCnic = useCallback((raw: string) => {
    dispatch({ type: 'CNIC_CHANGED', cnic: toCnicDigits(raw) });
  }, []);

  const submitCnic = useCallback(async () => {
    if (isSubmittingCnicRef.current) return;
    if (state.rateLimitedAction === 'cnic' && secondsUntilRateLimitCleared(state)) return;

    if (state.cnic.length === 0) {
      dispatch({ type: 'CNIC_SUBMIT_FAILED', error: 'REQUIRED', now: Date.now() });
      return;
    }
    if (!isValidCnic(state.cnic)) {
      dispatch({ type: 'CNIC_SUBMIT_FAILED', error: 'INVALID_FORMAT', now: Date.now() });
      return;
    }

    isSubmittingCnicRef.current = true;
    const generation = generationRef.current;
    dispatch({ type: 'CNIC_SUBMIT_STARTED' });
    try {
      const challenge = await client.requestOtp(state.cnic);
      if (generationRef.current !== generation) return;
      dispatch({ type: 'CNIC_SUBMIT_SUCCEEDED', challenge, now: Date.now() });
    } catch (error) {
      if (generationRef.current !== generation) return;
      dispatch({ type: 'CNIC_SUBMIT_FAILED', error: toAuthError(error), now: Date.now() });
    } finally {
      isSubmittingCnicRef.current = false;
    }
  }, [client, state]);

  const setOtp = useCallback((raw: string) => {
    dispatch({ type: 'OTP_CHANGED', otp: raw.replace(/\D/g, '') });
  }, []);

  const submitOtp = useCallback(
    async (codeOverride?: string) => {
      const code = codeOverride ?? state.otp;
      if (isSubmittingOtpRef.current) return;
      if (state.rateLimitedAction === 'otp' && secondsUntilRateLimitCleared(state)) return;
      if (!state.challenge || code.length !== OTP_LENGTH) return;

      isSubmittingOtpRef.current = true;
      const generation = generationRef.current;
      dispatch({ type: 'OTP_SUBMIT_STARTED' });
      try {
        const session = await client.verifyOtp(state.cnic, code);
        if (generationRef.current !== generation) return;
        await onAuthenticated(session);
      } catch (error) {
        if (generationRef.current !== generation) return;
        dispatch({ type: 'OTP_SUBMIT_FAILED', error: toAuthError(error), now: Date.now() });
      } finally {
        isSubmittingOtpRef.current = false;
      }
    },
    [client, onAuthenticated, state]
  );

  const resendOtp = useCallback(async () => {
    if (isResendingRef.current) return;
    if (state.rateLimitedAction === 'resend' && secondsUntilRateLimitCleared(state)) return;
    if (!state.challenge) return;

    isResendingRef.current = true;
    const generation = generationRef.current;
    dispatch({ type: 'RESEND_STARTED' });
    try {
      const challenge = await client.resendOtp(state.cnic);
      if (generationRef.current !== generation) return;
      dispatch({ type: 'RESEND_SUCCEEDED', challenge, now: Date.now() });
    } catch (error) {
      if (generationRef.current !== generation) return;
      dispatch({ type: 'RESEND_FAILED', error: toAuthError(error), now: Date.now() });
    } finally {
      isResendingRef.current = false;
    }
  }, [client, state]);

  const backToCnic = useCallback(() => {
    generationRef.current += 1;
    // A stale in-flight OTP/resend call, once it resolves, must not find
    // itself permanently "in progress" from the new generation's
    // perspective -- the generation check above already discards its
    // result, so releasing the guard now (rather than waiting for its own
    // `finally`) lets a fresh submit/resend proceed immediately.
    isSubmittingOtpRef.current = false;
    isResendingRef.current = false;
    dispatch({ type: 'BACK_TO_CNIC' });
  }, []);

  return {
    ...state,
    secondsUntilExpiry: secondsUntilExpiry(state),
    secondsUntilResendAvailable: secondsUntilResendAvailable(state),
    secondsUntilRateLimitCleared: secondsUntilRateLimitCleared(state),
    setCnic,
    submitCnic,
    setOtp,
    submitOtp,
    resendOtp,
    backToCnic,
  };
}

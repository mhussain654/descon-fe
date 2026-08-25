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

  // Keeps the expiry/resend countdowns live while an OTP challenge is outstanding.
  useEffect(() => {
    if (state.step !== 'otp') return undefined;
    const interval = setInterval(() => dispatch({ type: 'TICK', now: Date.now() }), 1000);
    return () => clearInterval(interval);
  }, [state.step]);

  const setCnic = useCallback((raw: string) => {
    dispatch({ type: 'CNIC_CHANGED', cnic: toCnicDigits(raw) });
  }, []);

  const submitCnic = useCallback(async () => {
    if (state.isSubmittingCnic) return;

    if (state.cnic.length === 0) {
      dispatch({ type: 'CNIC_SUBMIT_FAILED', error: 'REQUIRED' });
      return;
    }
    if (!isValidCnic(state.cnic)) {
      dispatch({ type: 'CNIC_SUBMIT_FAILED', error: 'INVALID_FORMAT' });
      return;
    }

    const generation = generationRef.current;
    dispatch({ type: 'CNIC_SUBMIT_STARTED' });
    try {
      const challenge = await client.requestOtp(state.cnic);
      if (generationRef.current !== generation) return;
      dispatch({ type: 'CNIC_SUBMIT_SUCCEEDED', challenge, now: Date.now() });
    } catch (error) {
      if (generationRef.current !== generation) return;
      dispatch({ type: 'CNIC_SUBMIT_FAILED', error: toAuthError(error) });
    }
  }, [client, state.cnic, state.isSubmittingCnic]);

  const setOtp = useCallback((raw: string) => {
    dispatch({ type: 'OTP_CHANGED', otp: raw.replace(/\D/g, '') });
  }, []);

  const submitOtp = useCallback(
    async (codeOverride?: string) => {
      const code = codeOverride ?? state.otp;
      if (state.isSubmittingOtp || !state.challenge || code.length !== OTP_LENGTH) return;

      const generation = generationRef.current;
      dispatch({ type: 'OTP_SUBMIT_STARTED' });
      try {
        const session = await client.verifyOtp(state.cnic, code);
        if (generationRef.current !== generation) return;
        await onAuthenticated(session);
      } catch (error) {
        if (generationRef.current !== generation) return;
        dispatch({ type: 'OTP_SUBMIT_FAILED', error: toAuthError(error) });
      }
    },
    [client, onAuthenticated, state.challenge, state.cnic, state.isSubmittingOtp, state.otp]
  );

  const resendOtp = useCallback(async () => {
    if (state.isResending || !state.challenge) return;

    const generation = generationRef.current;
    dispatch({ type: 'RESEND_STARTED' });
    try {
      const challenge = await client.resendOtp(state.cnic);
      if (generationRef.current !== generation) return;
      dispatch({ type: 'RESEND_SUCCEEDED', challenge, now: Date.now() });
    } catch (error) {
      if (generationRef.current !== generation) return;
      dispatch({ type: 'RESEND_FAILED', error: toAuthError(error) });
    }
  }, [client, state.challenge, state.cnic, state.isResending]);

  const backToCnic = useCallback(() => {
    generationRef.current += 1;
    dispatch({ type: 'BACK_TO_CNIC' });
  }, []);

  return {
    ...state,
    secondsUntilExpiry: secondsUntilExpiry(state),
    secondsUntilResendAvailable: secondsUntilResendAvailable(state),
    setCnic,
    submitCnic,
    setOtp,
    submitOtp,
    resendOtp,
    backToCnic,
  };
}

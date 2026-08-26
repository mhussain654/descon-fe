// Shared, platform-agnostic staff sign-in form state (MPS-F202) -- mirrors
// useCnicOtpFlow.ts's role: pure React (no DOM/RN-specific API), owning the
// business logic so the route/page component stays focused on composition
// (AGENTS.md: "Keep route/page components focused on composition"). Staff
// admin is web-only today (AGENTS.md: "administrative workflows remain
// web-focused"), but the hook still lives in shared/ rather than web/ so it
// stays unit-testable in isolation and ready if a staff-facing mobile
// surface is ever approved.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { StaffAuthClient, StaffAuthError, StaffSession } from './staffTypes';

export type StaffSignInFieldError = 'REQUIRED';

export interface UseStaffSignInOptions {
  client: StaffAuthClient;
  onAuthenticated: (session: StaffSession) => void | Promise<void>;
}

export interface UseStaffSignInResult {
  email: string;
  password: string;
  /**
   * Local, pre-submit required-field validation only. Deliberately not
   * field-addressable beyond "required" -- once credentials actually reach
   * the client, every failure (unknown email, wrong password, locked,
   * suspended) collapses into one generic error (see `error`), never tied
   * to a specific field, so the UI can't imply which field was wrong
   * (MPS-F202: don't reveal whether an account exists).
   */
  fieldErrors: { email?: StaffSignInFieldError; password?: StaffSignInFieldError };
  error: StaffAuthError | null;
  isSubmitting: boolean;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  submit: () => Promise<void>;
}

function toStaffAuthError(error: unknown): StaffAuthError {
  if (error && typeof error === 'object' && 'code' in error) {
    return error as StaffAuthError;
  }
  return { code: 'UNKNOWN' };
}

export function useStaffSignIn({ client, onAuthenticated }: UseStaffSignInOptions): UseStaffSignInResult {
  const [email, setEmailState] = useState('');
  const [password, setPasswordState] = useState('');
  const [fieldErrors, setFieldErrors] = useState<UseStaffSignInResult['fieldErrors']>({});
  const [error, setError] = useState<StaffAuthError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // `isSubmitting` state is what the UI reads, but two synchronous submit()
  // calls (e.g. a double-click) can both read the *same* stale `false`
  // before React applies the first call's setIsSubmitting(true) -- state
  // updates aren't synchronous. A ref is read/written immediately, so it
  // reliably blocks the second call even within the same tick.
  const isSubmittingRef = useRef(false);

  // A submit that's still in flight when the screen unmounts (the candidate
  // navigates away, or the app is torn down) must not call onAuthenticated
  // or setError once it resolves (AGENTS.md: "Prevent stale requests from
  // changing state after ... navigation").
  const mountedRef = useRef(true);
  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const setEmail = useCallback((value: string) => {
    setEmailState(value);
    setFieldErrors((prev) => (prev.email ? { ...prev, email: undefined } : prev));
    setError(null);
  }, []);

  const setPassword = useCallback((value: string) => {
    setPasswordState(value);
    setFieldErrors((prev) => (prev.password ? { ...prev, password: undefined } : prev));
    setError(null);
  }, []);

  const submit = useCallback(async () => {
    if (isSubmittingRef.current) return;

    const nextFieldErrors: UseStaffSignInResult['fieldErrors'] = {};
    if (!email.trim()) nextFieldErrors.email = 'REQUIRED';
    if (!password) nextFieldErrors.password = 'REQUIRED';
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setError(null);
    try {
      const session = await client.signIn({ email, password });
      if (!mountedRef.current) return;
      await onAuthenticated(session);
    } catch (submitError) {
      if (!mountedRef.current) return;
      setError(toStaffAuthError(submitError));
    } finally {
      isSubmittingRef.current = false;
      if (mountedRef.current) setIsSubmitting(false);
    }
  }, [client, email, password, onAuthenticated]);

  return { email, password, fieldErrors, error, isSubmitting, setEmail, setPassword, submit };
}

// Exercises the shared hook (shared/auth/useStaffSignIn.ts) through web's own
// testing library. Staff auth is web-only today (AGENTS.md: "administrative
// workflows remain web-focused"), so there is no mobile equivalent -- unlike
// useCnicOtpFlow, which both platforms exercise separately.
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from '../../../../shared/auth/staffAuthClient';
import { useStaffSignIn } from '../../../../shared/auth/useStaffSignIn';

const ADMIN = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'admin')!;

function setUp(onAuthenticated = vi.fn()) {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  const { result } = renderHook(() => useStaffSignIn({ client, onAuthenticated }));
  return { result, onAuthenticated };
}

describe('useStaffSignIn', () => {
  it('requires both fields before calling the client', async () => {
    const client = createMockStaffAuthClient({ delayMs: 0 });
    const signInSpy = vi.spyOn(client, 'signIn');
    const { result } = renderHook(() => useStaffSignIn({ client, onAuthenticated: vi.fn() }));

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.fieldErrors).toEqual({ email: 'REQUIRED', password: 'REQUIRED' });
    expect(signInSpy).not.toHaveBeenCalled();
  });

  it('signs in and calls onAuthenticated with the session on valid credentials', async () => {
    const onAuthenticated = vi.fn();
    const { result } = setUp(onAuthenticated);

    act(() => {
      result.current.setEmail(ADMIN.email);
      result.current.setPassword(MOCK_STAFF_PASSWORD);
    });
    await act(async () => {
      await result.current.submit();
    });

    expect(onAuthenticated).toHaveBeenCalledTimes(1);
    expect(onAuthenticated).toHaveBeenCalledWith(expect.objectContaining({ staffId: ADMIN.staffId }));
    expect(result.current.error).toBeNull();
  });

  it('surfaces a generic INVALID_CREDENTIALS error without touching a specific field', async () => {
    const { result } = setUp();

    act(() => {
      result.current.setEmail(ADMIN.email);
      result.current.setPassword('wrong-password');
    });
    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.error).toEqual({ code: 'INVALID_CREDENTIALS' });
    expect(result.current.fieldErrors).toEqual({});
  });

  it('clears a field error and any prior submit error as soon as that field is edited', async () => {
    const { result } = setUp();

    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.fieldErrors.email).toBe('REQUIRED');

    act(() => {
      result.current.setEmail('a');
    });
    expect(result.current.fieldErrors.email).toBeUndefined();
  });

  it('does not submit again while a submission is already in flight', async () => {
    const client = createMockStaffAuthClient({ delayMs: 20 });
    const signInSpy = vi.spyOn(client, 'signIn');
    const { result } = renderHook(() => useStaffSignIn({ client, onAuthenticated: vi.fn() }));

    act(() => {
      result.current.setEmail(ADMIN.email);
      result.current.setPassword(MOCK_STAFF_PASSWORD);
    });

    act(() => {
      result.current.submit();
      result.current.submit();
    });
    expect(result.current.isSubmitting).toBe(true);

    await waitFor(() => expect(result.current.isSubmitting).toBe(false));
    expect(signInSpy).toHaveBeenCalledTimes(1);
  });
});

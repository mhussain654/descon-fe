import { useCallback, useEffect, useRef, useState } from 'react';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import type { AdminWorkflowError } from '../../../../lib/admin-workflow-client';

export interface UseShortLivedAccessResult<TAccess> {
  access: TAccess | null;
  isRequesting: boolean;
  error: AdminWorkflowError | null;
  /** True once the access's own `expiresAt` has passed -- the caller must request a fresh one rather than keep using the stored `url`. */
  isExpired: boolean;
  requestAccess: (fetchAccess: () => Promise<TAccess>) => Promise<void>;
  clearAccess: () => void;
}

/**
 * Manages one short-lived staff-access credential at a time (a visa-copy or
 * flight-ticket signed URL) -- shared by useVisaCopyAccess.ts and
 * useFlightTicketAccess.ts, both of which need identical never-persisted,
 * auto-expiring, logout-cleared handling, following the exact precedent set
 * by admin/documentReviews/hooks/useDocumentAccess.ts. Never backed by
 * TanStack Query (a query cache is itself a form of persistence this
 * credential must never enter) and never written to localStorage/
 * sessionStorage -- it lives only in this component-local React state.
 */
export function useShortLivedAccess<TAccess extends { expiresAt: string }>(): UseShortLivedAccessResult<TAccess> {
  const { status } = useStaffAuth();
  const [access, setAccess] = useState<TAccess | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<AdminWorkflowError | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Every requestAccess()/clearAccess() call bumps this so a slow response
  // for a credential the caller already closed or replaced can't land
  // afterward and silently restore or overwrite it -- same guard as
  // useDocumentAccess.ts.
  const requestVersionRef = useRef(0);

  const clearExpiryTimer = useCallback(() => {
    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
  }, []);

  const clearAccess = useCallback(() => {
    requestVersionRef.current += 1;
    clearExpiryTimer();
    setAccess(null);
    setIsExpired(false);
    setError(null);
    setIsRequesting(false);
  }, [clearExpiryTimer]);

  const requestAccess = useCallback(
    async (fetchAccess: () => Promise<TAccess>) => {
      clearAccess();
      const requestVersion = ++requestVersionRef.current;
      setIsRequesting(true);
      try {
        const result = await fetchAccess();
        if (requestVersion !== requestVersionRef.current) return;

        setAccess(result);
        setIsExpired(false);
        const msUntilExpiry = new Date(result.expiresAt).getTime() - Date.now();
        expiryTimerRef.current = setTimeout(() => {
          if (requestVersion !== requestVersionRef.current) return;
          setIsExpired(true);
        }, Math.max(msUntilExpiry, 0));
      } catch (requestError) {
        if (requestVersion !== requestVersionRef.current) return;
        setError(requestError as AdminWorkflowError);
      } finally {
        if (requestVersion === requestVersionRef.current) {
          setIsRequesting(false);
        }
      }
    },
    [clearAccess]
  );

  // A candidate/other staff session on this device must never inherit a
  // still-live access credential.
  useEffect(() => {
    if (status !== 'authenticated') {
      clearAccess();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Covers navigation away (the owning component/dialog unmounting) even if
  // the caller forgets to call clearAccess() itself.
  useEffect(() => clearExpiryTimer, [clearExpiryTimer]);

  return { access, isRequesting, error, isExpired, requestAccess, clearAccess };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import { adminDocumentReviewsClient } from '../../../../lib/admin-document-reviews-client';
import type { AdminDocumentReviewError, DocumentAccess } from '../../../../lib/admin-document-reviews-client';

export interface UseDocumentAccessResult {
  access: DocumentAccess | null;
  isRequesting: boolean;
  error: AdminDocumentReviewError | null;
  /** True once the access's own `expiresAt` has passed -- the caller must request a fresh one rather than keep using `access.url`. */
  isExpired: boolean;
  requestAccess: (documentId: string) => Promise<void>;
  clearAccess: () => void;
}

/**
 * Manages one short-lived document-preview credential at a time. Never
 * backed by TanStack Query (a query cache is itself a form of persistence
 * this credential must never enter -- ticket: "Do not retain them in
 * persistent query caches") and never written to localStorage/sessionStorage
 * -- it lives only in this component-local React state, which disappears the
 * moment this hook's owning component unmounts.
 */
export function useDocumentAccess(): UseDocumentAccessResult {
  const { status } = useStaffAuth();
  const [access, setAccess] = useState<DocumentAccess | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<AdminDocumentReviewError | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Every requestAccess()/clearAccess() call bumps this. A response is only
  // applied if it's still the current generation when it resolves -- without
  // this, a slow response for a document the reviewer already closed (or
  // navigated away from, or replaced by opening a different document) could
  // land afterward and silently restore or overwrite the access credential
  // (review finding: "A closed preview request can restore a private access
  // credential").
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
    async (documentId: string) => {
      clearAccess();
      const requestVersion = ++requestVersionRef.current;
      setIsRequesting(true);
      try {
        const result = await adminDocumentReviewsClient.requestDocumentAccess(documentId);
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
        setError(requestError as AdminDocumentReviewError);
      } finally {
        if (requestVersion === requestVersionRef.current) {
          setIsRequesting(false);
        }
      }
    },
    [clearAccess]
  );

  // A candidate/other staff session on this device must never inherit a
  // still-live preview credential (ticket: "Clear it on logout.").
  useEffect(() => {
    if (status !== 'authenticated') {
      clearAccess();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Covers navigation away (the owning component/dialog unmounting) even if
  // the caller forgets to call clearAccess() itself -- the timer must not
  // outlive the component.
  useEffect(() => clearExpiryTimer, [clearExpiryTimer]);

  return { access, isRequesting, error, isExpired, requestAccess, clearAccess };
}

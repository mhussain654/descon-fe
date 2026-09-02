import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../../contexts/AuthContext';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { paymentsClient } from '../../../../lib/payments-client';
import type { PaymentEligibility, PaymentError } from '../../../../lib/payments-client';
import { paymentQueries } from '../../../../../../shared/queryKeys/paymentQueries';
import { documentQueries } from '../../../../../../shared/queryKeys/documentQueries';
import { profileQueries } from '../../../../../../shared/queryKeys/profileQueries';
import {
  CHECKOUT_PENDING_POLL_INTERVAL_MS,
  CHECKOUT_POLL_TIMEOUT_MS,
  hasPollingTimedOut,
  isCheckoutPending,
} from '../../../../../../shared/payments/checkoutPolling';

/**
 * Fetches the authenticated candidate's own payment eligibility and latest
 * payment. Identity comes only from `session.accessToken`, matching
 * useApplicationProgress.ts's identical rationale.
 *
 * No automatic retry -- every error state maps to a distinct, visible UI
 * state with its own explicit "Retry" action. Polls while a checkout is
 * pending (see shared/payments/checkoutPolling.ts) so the pending-
 * confirmation screen notices the provider's async callback without a
 * manual refresh -- but only for up to `CHECKOUT_POLL_TIMEOUT_MS`; after
 * that, `pollingTimedOut` becomes true and the caller must offer an
 * explicit manual refresh instead (ticket: "Stop polling after a safe
 * timeout and provide manual refresh").
 *
 * Also invalidates the dashboard's application-progress and profile
 * queries the moment a payment is observed transitioning to `paid`, so
 * the Dashboard reflects the confirmed fee without the candidate having
 * to navigate away and back (ticket: "Dashboard/application-progress
 * refresh after payment confirmation").
 */
export function usePaymentEligibility() {
  const { session, status } = useAuth();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const candidateId = session?.candidateId ?? 'anonymous';
  const pendingSinceRef = useRef<number | null>(null);
  const [pollingTimedOut, setPollingTimedOut] = useState(false);
  const wasPendingRef = useRef(false);

  const query = useQuery<PaymentEligibility, PaymentError>({
    queryKey: paymentQueries.eligibility(candidateId, language),
    queryFn: () => paymentsClient.getEligibility((session as { accessToken: string }).accessToken),
    enabled: status === 'authenticated' && !!session,
    retry: false,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
    refetchInterval: (activeQuery) =>
      isCheckoutPending(activeQuery.state.data) && !pollingTimedOut ? CHECKOUT_PENDING_POLL_INTERVAL_MS : false,
  });

  // Tracks how long the current checkout has been pending, independent of
  // React Query's own refetch bookkeeping, and flips `pollingTimedOut`
  // once it's been too long -- resets the moment it's no longer pending
  // (a fresh checkout later gets its own full timeout window).
  useEffect(() => {
    if (!isCheckoutPending(query.data)) {
      pendingSinceRef.current = null;
      setPollingTimedOut(false);
      return undefined;
    }
    if (pendingSinceRef.current === null) pendingSinceRef.current = Date.now();
    if (hasPollingTimedOut(pendingSinceRef.current, Date.now())) {
      setPollingTimedOut(true);
      return undefined;
    }
    const remainingMs = CHECKOUT_POLL_TIMEOUT_MS - (Date.now() - pendingSinceRef.current);
    const timer = setTimeout(() => setPollingTimedOut(true), remainingMs);
    return () => clearTimeout(timer);
  }, [query.data]);

  useEffect(() => {
    const isPending = isCheckoutPending(query.data);
    const justConfirmedPaid = wasPendingRef.current && query.data?.latestPayment?.status === 'paid';
    wasPendingRef.current = isPending;
    if (!justConfirmedPaid) return;

    queryClient.invalidateQueries({ queryKey: documentQueries.applicationProgress(candidateId, language) });
    queryClient.invalidateQueries({ queryKey: profileQueries.candidate(candidateId, language) });
  }, [query.data, queryClient, candidateId, language]);

  return { ...query, pollingTimedOut };
}

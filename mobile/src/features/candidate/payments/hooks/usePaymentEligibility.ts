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
 * Mirrors web's usePaymentEligibility.ts exactly -- see its comments for
 * full rationale (polling, timeout, and dashboard/profile invalidation on
 * a confirmed payment). Unlike web, the candidate session here is backed
 * by expo-secure-store and survives leaving the app for the hosted
 * checkout page and coming back, so there is no "new tab" workaround
 * needed on this platform -- the checkout browser session is opened and
 * dismissed from the same screen (see useInitiateCheckout.ts /
 * app/payment/index.jsx), and this hook's own focus-refetch (wired at the
 * screen level via useRefetchOnFocus) plus this interval/timeout logic
 * covers noticing the outcome either way.
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

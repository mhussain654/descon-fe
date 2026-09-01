import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../contexts/AuthContext';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { paymentsClient } from '../../../../lib/payments-client';
import type { PaymentEligibility, PaymentError } from '../../../../lib/payments-client';
import { paymentQueries } from '../../../../../../shared/queryKeys/paymentQueries';
import { CHECKOUT_PENDING_POLL_INTERVAL_MS, isCheckoutPending } from '../../../../../../shared/payments/checkoutPolling';

/**
 * Fetches the authenticated candidate's own payment eligibility and latest
 * payment. Identity comes only from `session.accessToken`, matching
 * useApplicationProgress.ts's identical rationale.
 *
 * No automatic retry -- every error state maps to a distinct, visible UI
 * state with its own explicit "Retry" action. Polls while a checkout is
 * pending (see shared/payments/checkoutPolling.ts) so the pending-
 * confirmation screen notices the provider's async callback without a
 * manual refresh.
 */
export function usePaymentEligibility() {
  const { session, status } = useAuth();
  const { language } = useLanguage();
  const candidateId = session?.candidateId ?? 'anonymous';

  return useQuery<PaymentEligibility, PaymentError>({
    queryKey: paymentQueries.eligibility(candidateId, language),
    queryFn: () => paymentsClient.getEligibility((session as { accessToken: string }).accessToken),
    enabled: status === 'authenticated' && !!session,
    retry: false,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
    refetchInterval: (query) => (isCheckoutPending(query.state.data) ? CHECKOUT_PENDING_POLL_INTERVAL_MS : false),
  });
}

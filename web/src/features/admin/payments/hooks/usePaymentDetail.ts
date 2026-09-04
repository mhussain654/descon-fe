import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminPaymentsClient, type AdminPaymentError, type PaymentDetail } from '../../../../lib/admin-payments-client';
import { adminPaymentQueries } from '../../../../../../shared/queryKeys/adminPaymentQueries';

/**
 * The sole source of truth for one payment's current state, event history
 * and reconciliation findings -- never derived or cached anywhere else on
 * the frontend. Unlike the candidate-import batch detail (which polls while
 * a batch is processing), a payment's state only ever changes through a
 * staff-initiated correction or a real provider event -- there is no
 * "still processing" status to wait out here, so this is a plain query with
 * no polling.
 */
export function usePaymentDetail(paymentId: string | undefined) {
  const { language } = useLanguage();

  return useQuery<PaymentDetail, AdminPaymentError>({
    queryKey: adminPaymentQueries.detail(paymentId ?? '', language),
    queryFn: () => adminPaymentsClient.getPayment(paymentId as string),
    enabled: Boolean(paymentId),
    retry: false,
  });
}

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import {
  adminPaymentsClient,
  type PaymentListFilters,
  type PaymentListPage,
  type PaymentListSort,
} from '../../../../lib/admin-payments-client';
import { adminPaymentQueries } from '../../../../../../shared/queryKeys/adminPaymentQueries';

/**
 * The finance transaction list, paginated -- mirrors useCandidateList.ts's
 * identical pattern (query key includes search/filters/sort/page/locale in
 * full, so any change is a genuinely different query; `keepPreviousData`
 * avoids a loading flash between pages/filters).
 */
export function usePaymentList(filters: PaymentListFilters, sort: PaymentListSort | undefined, page: PaymentListPage) {
  const { language } = useLanguage();

  return useQuery({
    queryKey: adminPaymentQueries.list(filters, sort, page, language),
    queryFn: () => adminPaymentsClient.listPayments(filters, sort, page),
    placeholderData: keepPreviousData,
  });
}

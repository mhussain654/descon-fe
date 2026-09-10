import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import {
  adminAuditEventsClient,
  type AuditEventListFilters,
  type AuditEventListPage,
  type AuditEventListSort,
} from '../../../../lib/admin-audit-events-client';
import { adminAuditEventQueries } from '../../../../../../shared/queryKeys/adminAuditEventQueries';

/**
 * The audit explorer's event list, paginated -- mirrors usePaymentList.ts's
 * identical pattern (query key includes filters/sort/page/locale in full,
 * so any change is a genuinely different query; `keepPreviousData` avoids a
 * loading flash between pages/filters).
 */
export function useAuditEventList(filters: AuditEventListFilters, sort: AuditEventListSort | undefined, page: AuditEventListPage) {
  const { language } = useLanguage();

  return useQuery({
    queryKey: adminAuditEventQueries.list(filters, sort, page, language),
    queryFn: () => adminAuditEventsClient.listAuditEvents(filters, sort, page),
    placeholderData: keepPreviousData,
  });
}

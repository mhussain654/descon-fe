import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import {
  adminCommunicationsClient,
  type CommunicationListFilters,
  type CommunicationListPage,
  type CommunicationListSort,
} from '../../../../lib/admin-communications-client';
import { adminCommunicationQueries } from '../../../../../../shared/queryKeys/adminCommunicationQueries';

/**
 * The communications log's list, paginated -- mirrors useAuditEventList.ts's
 * identical pattern (query key includes filters/sort/page/locale in full,
 * so any change is a genuinely different query; `keepPreviousData` avoids a
 * loading flash between pages/filters).
 */
export function useCommunicationList(filters: CommunicationListFilters, sort: CommunicationListSort | undefined, page: CommunicationListPage) {
  const { language } = useLanguage();

  return useQuery({
    queryKey: adminCommunicationQueries.list(filters, sort, page, language),
    queryFn: () => adminCommunicationsClient.listCommunications(filters, sort, page),
    placeholderData: keepPreviousData,
  });
}

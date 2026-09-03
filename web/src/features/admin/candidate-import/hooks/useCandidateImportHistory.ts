import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import {
  candidateImportClient,
  type CandidateImportError,
  type CandidateImportHistoryFilters,
  type CandidateImportHistoryPage,
  type CandidateImportHistoryResult,
} from '../../../../lib/candidate-import-client';
import { candidateImportQueries } from '../../../../../../shared/queryKeys/candidateImportQueries';

/**
 * The candidate manager's own import history, paginated -- mirrors
 * useCandidateList.ts's/useDocumentReviewQueue.ts's identical pattern
 * (query key includes filters/page/locale in full, so a filter or page
 * change is a genuinely different query; `keepPreviousData` avoids a
 * loading flash between pages).
 */
export function useCandidateImportHistory(filters: CandidateImportHistoryFilters, page: CandidateImportHistoryPage) {
  const { language } = useLanguage();

  return useQuery<CandidateImportHistoryResult, CandidateImportError>({
    queryKey: candidateImportQueries.history(filters, page, language),
    queryFn: () => candidateImportClient.listImportHistory(filters, page),
    placeholderData: keepPreviousData,
  });
}

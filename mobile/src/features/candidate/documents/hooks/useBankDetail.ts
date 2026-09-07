import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../contexts/AuthContext';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { candidateBankDetailsClient } from '../../../../lib/candidate-bank-details-client';
import type { CandidateBankDetailsError, CandidateBankDetailSummary } from '../../../../lib/candidate-bank-details-client';
import { documentQueries } from '../../../../../../shared/queryKeys/documentQueries';

/**
 * Fetches the authenticated candidate's own bank-detail submission state.
 * Mirrors web/src/features/candidate/documents/hooks/useBankDetail.ts
 * exactly. Explicit generics (mirroring useBankDetailUpload.ts's mutation)
 * type the error as CandidateBankDetailsError rather than TanStack Query's
 * default `Error`, since BankDetailsPanel.tsx reads `.code` off it.
 */
export function useBankDetail() {
  const { session, status } = useAuth();
  const { language } = useLanguage();
  const candidateId = session?.candidateId ?? 'anonymous';

  return useQuery<CandidateBankDetailSummary, CandidateBankDetailsError>({
    queryKey: documentQueries.bankDetail(candidateId, language),
    queryFn: () => candidateBankDetailsClient.getBankDetail((session as { accessToken: string }).accessToken),
    enabled: status === 'authenticated' && !!session,
    retry: false,
  });
}

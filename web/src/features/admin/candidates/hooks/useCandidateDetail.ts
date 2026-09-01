import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminCandidateClient } from '../../../../lib/admin-candidates-client';
import type { AdminCandidateDetail, AdminCandidateError } from '../../../../lib/admin-candidates-client';
import { adminCandidateQueries } from '../../../../../../shared/queryKeys/adminCandidateQueries';

export function useCandidateDetail(candidateId: string | undefined) {
  const { language } = useLanguage();

  return useQuery<AdminCandidateDetail, AdminCandidateError>({
    queryKey: adminCandidateQueries.detail(candidateId ?? '', language),
    queryFn: () => adminCandidateClient.getCandidate(candidateId as string),
    enabled: Boolean(candidateId),
  });
}

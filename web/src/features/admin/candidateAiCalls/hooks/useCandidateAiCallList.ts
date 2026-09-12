import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminCandidateAiCallsClient } from '../../../../lib/admin-candidate-ai-calls-client';
import { adminCandidateAiCallQueries } from '../../../../../../shared/queryKeys/adminCandidateAiCallQueries';

/** This candidate's admin-triggered AI call history -- unpaginated (the backend returns the full list, matching how few admin-triggered calls one candidate plausibly accumulates). */
export function useCandidateAiCallList(candidateId: string | undefined) {
  const { language } = useLanguage();

  return useQuery({
    queryKey: adminCandidateAiCallQueries.list(candidateId ?? '', language),
    queryFn: () => adminCandidateAiCallsClient.listCandidateAiCalls(candidateId as string),
    enabled: Boolean(candidateId),
  });
}

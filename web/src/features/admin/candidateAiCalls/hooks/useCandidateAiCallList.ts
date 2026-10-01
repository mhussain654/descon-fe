import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminCandidateAiCallsClient } from '../../../../lib/admin-candidate-ai-calls-client';
import type { AdminCandidateAiCall } from '../../../../lib/admin-candidate-ai-calls-client';
import { adminCandidateAiCallQueries } from '../../../../../../shared/queryKeys/adminCandidateAiCallQueries';
import { isTerminalAiCallStatus } from '../../../../../../shared/adminCandidateAiCalls/types';

/** A triggered call's status/outcome only change server-side (the post-call
 * webhook or the reconciliation job), so nothing else would ever bring this
 * view out of a stale `requested`/`queued` state once a call is placed. */
export const AI_CALL_POLL_INTERVAL_MS = 8000;

/** Polling decision for the call-history query: keep polling while any call
 * in the list is still non-terminal (requested/queued/ringing/in_progress/
 * processing), stop once every call is terminal (or there's nothing to
 * poll for yet). Exported and tested standalone so this decision doesn't
 * depend on exercising TanStack Query's own interval-scheduling machinery. */
export function nextAiCallPollInterval(calls: AdminCandidateAiCall[] | undefined): number | false {
  if (!calls || calls.length === 0) return false;
  return calls.some((call) => !isTerminalAiCallStatus(call.status)) ? AI_CALL_POLL_INTERVAL_MS : false;
}

/** This candidate's admin-triggered AI call history -- unpaginated (the
 * backend returns the full list, matching how few admin-triggered calls one
 * candidate plausibly accumulates). Polls every few seconds while any call
 * is still non-terminal so ringing/in-progress/completed/answered/
 * not-answered/callback-required transitions actually show up, and stops
 * once every call is terminal (see nextAiCallPollInterval). Also refetches
 * on window focus -- the app disables that globally (see root.tsx), but a
 * live call is exactly the case where "did anything change while I was
 * away" matters. */
export function useCandidateAiCallList(candidateId: string | undefined) {
  const { language } = useLanguage();

  return useQuery({
    queryKey: adminCandidateAiCallQueries.list(candidateId ?? '', language),
    queryFn: () => adminCandidateAiCallsClient.listCandidateAiCalls(candidateId as string),
    enabled: Boolean(candidateId),
    refetchInterval: (query) => nextAiCallPollInterval(query.state.data),
    refetchOnWindowFocus: true,
  });
}

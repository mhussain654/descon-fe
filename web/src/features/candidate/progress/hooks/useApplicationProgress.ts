import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../contexts/AuthContext';
import { applicationProgressClient } from '../../../../lib/application-progress-client';
import type { ApplicationProgress, ApplicationProgressError } from '../../../../lib/application-progress-client';

/** Stable across the whole app so AuthContext's `queryClient.clear()` on logout reliably drops it, matching useCandidateDocuments.ts's CANDIDATE_DOCUMENTS_QUERY_KEY (AGENTS.md/ticket: "Clear candidate progress data ... on logout."). */
export const APPLICATION_PROGRESS_QUERY_KEY = ['application-progress'] as const;

/**
 * Fetches the authenticated candidate's own application progress. Identity
 * comes only from `session.accessToken` -- there is no candidate id
 * parameter this hook could be made to substitute (ticket: "Do not leak one
 * candidate's progress into another session.").
 *
 * No automatic retry -- mirrors useCandidateDocuments.ts's identical
 * rationale: every error state maps to a distinct, visible UI state with
 * its own explicit "Retry" action.
 *
 * The explicit `<ApplicationProgress, ApplicationProgressError>` generics
 * matter: `useQuery` otherwise defaults its error type to the built-in
 * `Error` (no `code`), which only surfaces as a real type error once
 * `query.error` is consumed directly rather than routed through an untyped
 * `.jsx` page boundary.
 */
export function useApplicationProgress() {
  const { session, status } = useAuth();

  return useQuery<ApplicationProgress, ApplicationProgressError>({
    queryKey: APPLICATION_PROGRESS_QUERY_KEY,
    queryFn: () => applicationProgressClient.getProgress((session as { accessToken: string }).accessToken),
    enabled: status === 'authenticated' && !!session,
    retry: false,
  });
}

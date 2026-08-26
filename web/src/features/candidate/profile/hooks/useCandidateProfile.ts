import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../contexts/AuthContext';
import { candidateProfileClient } from '../../../../lib/candidate-profile-client';

/** Stable across the whole app so AuthContext's `queryClient.clear()` on logout reliably drops it (AGENTS.md: "Clear profile data and candidate-sensitive query caches on logout"). */
export const CANDIDATE_PROFILE_QUERY_KEY = ['candidate-profile'] as const;

/**
 * Fetches the authenticated candidate's own profile. Identity comes only
 * from `session.accessToken` -- there is no candidate id parameter this
 * hook (or the screen using it) could be made to substitute (AGENTS.md/
 * ticket: "Do not permit users to change an ID to retrieve another
 * candidate").
 *
 * Deliberately does not react to errors itself (e.g. auto-logout on
 * SESSION_EXPIRED/INACTIVE_ACCOUNT) -- the screen owns that decision so it
 * can show the required distinct state (ticket: "Session expired" /
 * "Inactive account") before the candidate is moved anywhere, rather than
 * silently bouncing them to login the instant the error resolves.
 *
 * No automatic retry -- every state this hook can be in maps to a distinct,
 * visible UI state with its own explicit "Retry" action (CandidateProfileView),
 * so a silent background retry would just delay that state reaching the
 * screen without the candidate ever seeing or controlling it.
 */
export function useCandidateProfile() {
  const { session, status } = useAuth();

  return useQuery({
    queryKey: CANDIDATE_PROFILE_QUERY_KEY,
    queryFn: () => candidateProfileClient.getProfile((session as { accessToken: string }).accessToken),
    enabled: status === 'authenticated' && !!session,
    retry: false,
  });
}

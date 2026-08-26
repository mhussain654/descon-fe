import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../contexts/AuthContext';
import { candidateProfileClient } from '../../../../lib/candidate-profile-client';

/** Stable across the whole app so AuthContext's `queryClient.clear()` on logout reliably drops it (AGENTS.md: "Clear profile data and candidate-sensitive query caches on logout"). Matches web's key exactly, even though the caches are separate per-platform, for consistency. */
export const CANDIDATE_PROFILE_QUERY_KEY = ['candidate-profile'] as const;

/**
 * Fetches the authenticated candidate's own profile. Identity comes only
 * from `session.accessToken` -- there is no candidate id parameter this
 * hook (or the screen using it) could be made to substitute. Mirrors
 * web/src/features/candidate/profile/hooks/useCandidateProfile.ts exactly,
 * including the no-automatic-retry rationale documented there.
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

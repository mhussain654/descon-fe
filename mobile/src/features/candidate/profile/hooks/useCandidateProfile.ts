import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../contexts/AuthContext';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { candidateProfileClient } from '../../../../lib/candidate-profile-client';
import { profileQueries } from '../../../../../../shared/queryKeys/profileQueries';

/**
 * Fetches the authenticated candidate's own profile. Identity comes only
 * from `session.accessToken` -- there is no candidate id parameter this
 * hook (or the screen using it) could be made to substitute. Mirrors
 * web/src/features/candidate/profile/hooks/useCandidateProfile.ts exactly,
 * including the no-automatic-retry and focus-refetch rationale documented
 * there (screen-focus/tab-switch refetching is a separate concern handled
 * by the screen via `useFocusEffect`).
 */
export function useCandidateProfile() {
  const { session, status } = useAuth();
  const { language } = useLanguage();
  const candidateId = session?.candidateId ?? 'anonymous';

  return useQuery({
    queryKey: profileQueries.candidate(candidateId, language),
    queryFn: () => candidateProfileClient.getProfile((session as { accessToken: string }).accessToken),
    enabled: status === 'authenticated' && !!session,
    retry: false,
    refetchOnWindowFocus: true,
  });
}

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../contexts/AuthContext';
import { applicationProgressClient } from '../../../../lib/application-progress-client';
import type { ApplicationProgress, ApplicationProgressError } from '../../../../lib/application-progress-client';

/** Stable across the whole app so AuthContext's `queryClient.clear()` on logout reliably drops it. Matches web's identical key exactly. */
export const APPLICATION_PROGRESS_QUERY_KEY = ['application-progress'] as const;

/**
 * Fetches the authenticated candidate's own application progress. Mirrors
 * web/src/features/candidate/progress/hooks/useApplicationProgress.ts
 * exactly.
 *
 * The explicit `<ApplicationProgress, ApplicationProgressError>` generics
 * matter: `useQuery` otherwise defaults its error type to the built-in
 * `Error` (no `code`), which only surfaces as a real type error once
 * `query.error` is consumed directly inside a strictly-typed `.tsx`
 * component rather than routed through an untyped `.jsx` page boundary.
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

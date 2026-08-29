import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';

/**
 * Refetches a query when its screen/tab gains focus -- distinct from the
 * app-level foreground signal wired once via `focusManager`/`AppState` in
 * `app/_layout.jsx` (that covers backgrounding the whole app; this covers
 * switching tabs while the app stays foregrounded, which `AppState` never
 * sees). Ticket: "Refetch documents/progress/profile when their screen
 * gains focus."
 *
 * Skips the call while already fetching so mounting a screen that's already
 * mid-fetch (e.g. the very first focus) doesn't double the initial request.
 * `refetch`/`isFetching` are read from a ref (updated every render) so the
 * `useFocusEffect` callback itself can stay referentially stable -- it must
 * only re-run on an actual focus event, not on every render.
 */
export function useRefetchOnFocus(refetch: () => void, isFetching: boolean): void {
  const latest = useRef({ refetch, isFetching });
  latest.current = { refetch, isFetching };

  useFocusEffect(
    useCallback(() => {
      if (!latest.current.isFetching) latest.current.refetch();
    }, [])
  );
}

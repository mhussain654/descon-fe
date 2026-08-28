import { QueryClient } from '@tanstack/react-query';

interface Unmountable {
  unmount(): void;
}

/**
 * Tracks every test-local `QueryClient` (and every RTL render result) a test
 * file creates, so a single `afterEach` can tear all of them down properly
 * -- no matter how many a given test creates, and regardless of whether the
 * test itself remembered to capture the return value.
 *
 * Why this exists (see PR review): `queryClient.clear()` and
 * `defaultOptions.mutations.gcTime: 0` both look sufficient but aren't --
 * `MutationCache.clear()` never calls `Removable.destroy()`, so it never
 * clears a mutation's pending GC `setTimeout`; and `Removable.updateGcTime()`
 * combines gcTime via `Math.max()`, so a later per-observer call passing
 * `gcTime: undefined` (which `useMutation` does internally) silently
 * ratchets it back up to the 5-minute default. Left unfixed, every test that
 * triggers a mutation leaves a real ~5-minute timer on the event loop, which
 * is why `npm test -- --runInBand` didn't exit naturally once enough of
 * these accumulated across a full run.
 *
 * Unmounting the render *before* destroying mutations matters: a mutation
 * observer detaching (on unmount) is what schedules that GC timeout in the
 * first place, so destroying first and unmounting after can miss it.
 */
export function createQueryClientTestLifecycle() {
  const activeQueryClients = new Set<QueryClient>();
  const activeRenders = new Set<Unmountable>();

  function createTestQueryClient(): QueryClient {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { gcTime: 0 },
      },
    });
    activeQueryClients.add(queryClient);
    return queryClient;
  }

  function trackRender<T extends Unmountable>(rendered: T): T {
    activeRenders.add(rendered);
    return rendered;
  }

  async function cleanup(): Promise<void> {
    for (const rendered of activeRenders) {
      rendered.unmount();
    }
    activeRenders.clear();

    for (const queryClient of activeQueryClients) {
      await queryClient.cancelQueries();
      for (const mutation of queryClient.getMutationCache().getAll()) {
        mutation.destroy();
      }
      queryClient.clear();
    }
    activeQueryClients.clear();
  }

  return { createTestQueryClient, trackRender, cleanup };
}

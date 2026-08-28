import type { QueryClient } from '@tanstack/react-query';

/**
 * Call from `afterEach` for every test-local `QueryClient` that mounts a
 * component using `useMutation` (directly, or indirectly through a hook).
 *
 * `queryClient.clear()` looks like it should be enough, but
 * `MutationCache.clear()` only removes mutations from its internal maps and
 * notifies listeners -- it never calls `Removable.destroy()`, so it never
 * clears each mutation's pending GC `setTimeout`. Separately,
 * `defaultOptions.mutations.gcTime: 0` doesn't reliably stay at 0 either:
 * `Removable.updateGcTime()` combines the new value with the current one via
 * `Math.max()`, so a later per-observer call passing `gcTime: undefined`
 * (which `useMutation` does internally) silently ratchets it back up to the
 * 5-minute default, and `Math.max` can never bring it back down.
 *
 * The result, without this: every test that triggers a mutation leaves a
 * real ~5-minute `setTimeout` registered on the event loop, which is exactly
 * why `npm test -- --runInBand` doesn't exit naturally once enough of these
 * accumulate across a full run.
 *
 * Calling `.destroy()` directly bypasses gcTime entirely -- it just clears
 * whatever timeout is currently scheduled, unconditionally.
 */
export function destroyQueryClientMutations(queryClient: QueryClient): void {
  for (const mutation of queryClient.getMutationCache().getAll()) {
    mutation.destroy();
  }
}

import { useEffect, useRef, useState } from 'react';
import { useDebouncedValue } from './useDebouncedValue';

/**
 * Binds a single free-text filter's input value to the URL (via `onCommit`)
 * with debouncing, while keeping the input responsive to every keystroke:
 * - Typing updates local `draft` immediately (no lag in the input itself).
 * - `onCommit` fires only after typing pauses for `delayMs`.
 * - A change to `urlValue` from outside this hook (browser back/forward,
 *   a "Clear filters" action, another filter's commit resetting the page)
 *   re-syncs `draft` to match -- the `lastCommitted` ref is what tells the
 *   two effects below apart, so pushing our own debounced value doesn't
 *   immediately bounce back and re-render the input with stale text.
 */
export function useDebouncedUrlFilter(
  urlValue: string,
  onCommit: (value: string) => void,
  delayMs = 400
): readonly [string, (value: string) => void] {
  const [draft, setDraft] = useState(urlValue);
  const debounced = useDebouncedValue(draft, delayMs);
  const lastCommitted = useRef(urlValue);

  useEffect(() => {
    if (debounced === lastCommitted.current) return;
    lastCommitted.current = debounced;
    onCommit(debounced);
    // `onCommit` is expected to be stable (or at least not to require
    // re-running this effect on identity change alone) -- only `debounced`
    // should trigger a commit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  useEffect(() => {
    if (urlValue !== lastCommitted.current) {
      lastCommitted.current = urlValue;
      setDraft(urlValue);
    }
  }, [urlValue]);

  return [draft, setDraft] as const;
}

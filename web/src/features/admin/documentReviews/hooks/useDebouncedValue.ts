import { useEffect, useState } from 'react';

/** Returns `value`, but only after it has stopped changing for `delayMs` -- used for the queue's free-text filters (candidate ID, project code, country code) so a change doesn't refetch on every keystroke. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

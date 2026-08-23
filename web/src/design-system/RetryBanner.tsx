import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

export interface RetryBannerProps {
  /** Already-translated message, e.g. "Showing saved data -- couldn't refresh." */
  message: string;
  /** Already-translated retry button label, e.g. `t('retry')`. */
  retryLabel: string;
  onRetry: () => void;
}

/**
 * Inline, non-blocking banner for a background refresh that failed while
 * usable cached data is still on screen (AGENTS.md: "Preserve usable cached
 * data when a background refresh fails"). Use ErrorState instead when there
 * is no cached data to fall back to.
 */
export function RetryBanner({ message, retryLabel, onRetry }: RetryBannerProps) {
  return (
    <div role="status" className="flex items-center justify-between gap-3 rounded-xl bg-warning-subtle px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-warning-emphasis">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{message}</span>
      </div>
      <Button variant="text" size="sm" onClick={onRetry}>
        {retryLabel}
      </Button>
    </div>
  );
}

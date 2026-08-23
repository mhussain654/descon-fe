import { WifiOff } from 'lucide-react';
import { StatePanel } from './StatePanel';

export interface OfflineStateProps {
  /** Already-translated heading, e.g. `t('dsOfflineTitle')`. */
  title: string;
  /** Already-translated description, e.g. `t('dsOfflineDescription')`. */
  description?: string;
  /** Already-translated retry button label, e.g. `t('retry')`. Omit to hide the action. */
  retryLabel?: string;
  onRetry?: () => void;
}

/** Full-section state for a view that requires connectivity it doesn't currently have. Pair with `useOnlineStatus`. */
export function OfflineState({ title, description, retryLabel, onRetry }: OfflineStateProps) {
  return (
    <div role="status">
      <StatePanel
        icon={<WifiOff className="h-10 w-10 text-text-tertiary" />}
        title={title}
        description={description}
        actionLabel={retryLabel}
        onAction={onRetry}
      />
    </div>
  );
}

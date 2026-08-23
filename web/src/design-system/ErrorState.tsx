import { AlertCircle } from 'lucide-react';
import { StatePanel } from './StatePanel';

export interface ErrorStateProps {
  /** Already-translated message, e.g. `t('somethingWentWrong')`. */
  message: string;
  /** Already-translated retry button label, e.g. `t('retry')`. Omit to hide the action. */
  retryLabel?: string;
  onRetry?: () => void;
}

/** Full-section error state for a remote-data view that failed to load anything usable. */
export function ErrorState({ message, retryLabel, onRetry }: ErrorStateProps) {
  return (
    <div role="alert">
      <StatePanel
        icon={<AlertCircle className="h-10 w-10 text-danger" />}
        description={message}
        actionLabel={retryLabel}
        onAction={onRetry}
      />
    </div>
  );
}

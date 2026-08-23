import { Spinner } from './Spinner';

export interface LoadingStateProps {
  /** Already-translated message, e.g. `t('loading')`. */
  message: string;
}

/** Full-section loading state for a remote-data view. */
export function LoadingState({ message }: LoadingStateProps) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-text-secondary">
      <Spinner size="sm" label={message} />
      <span aria-hidden="true">{message}</span>
    </div>
  );
}

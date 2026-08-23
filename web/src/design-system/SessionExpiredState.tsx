import { LogIn } from 'lucide-react';
import { StatePanel } from './StatePanel';

export interface SessionExpiredStateProps {
  /** Already-translated heading, e.g. `t('dsSessionExpiredTitle')`. */
  title: string;
  /** Already-translated description, e.g. `t('dsSessionExpiredDescription')`. */
  description?: string;
  /** Already-translated action label, e.g. `t('dsSessionExpiredAction')`. */
  actionLabel: string;
  onAction: () => void;
}

/** Full-section state for an expired/invalidated session, prompting re-authentication. */
export function SessionExpiredState({ title, description, actionLabel, onAction }: SessionExpiredStateProps) {
  return (
    <div role="alert">
      <StatePanel
        icon={<LogIn className="h-10 w-10 text-brand" />}
        title={title}
        description={description}
        actionLabel={actionLabel}
        onAction={onAction}
      />
    </div>
  );
}

import { ShieldAlert } from 'lucide-react';
import { StatePanel } from './StatePanel';

export interface ForbiddenStateProps {
  /** Already-translated heading, e.g. `t('dsForbiddenTitle')`. */
  title: string;
  /** Already-translated description, e.g. `t('dsForbiddenDescription')`. */
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Full-section state for a 403/authorization failure. */
export function ForbiddenState({ title, description, actionLabel, onAction }: ForbiddenStateProps) {
  return (
    <div role="alert">
      <StatePanel
        icon={<ShieldAlert className="h-10 w-10 text-danger" />}
        title={title}
        description={description}
        actionLabel={actionLabel}
        onAction={onAction}
      />
    </div>
  );
}

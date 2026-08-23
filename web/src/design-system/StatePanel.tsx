import type { ReactNode } from 'react';
import { Button } from './Button';

export interface StatePanelProps {
  icon?: ReactNode;
  /** Already-translated heading. */
  title?: string;
  /** Already-translated supporting text. */
  description?: string;
  /** Already-translated action button label. Omit to hide the action. */
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
}

/**
 * Shared layout for full-section states (empty/error/offline/forbidden/
 * session-expired). Not exported on its own -- each state below fixes an
 * icon and semantics (e.g. `role="alert"` for errors) appropriate to it.
 */
export function StatePanel({ icon, title, description, actionLabel, onAction, children }: StatePanelProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      {icon ? <div aria-hidden="true">{icon}</div> : null}
      {title ? <p className="text-base font-semibold text-text-primary">{title}</p> : null}
      {description ? <p className="max-w-sm text-sm text-text-secondary">{description}</p> : null}
      {children}
      {actionLabel && onAction ? (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

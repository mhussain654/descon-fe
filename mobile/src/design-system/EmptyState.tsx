import { Inbox } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { colors } from './tokens';
import { StatePanel } from './StatePanel';

export interface EmptyStateProps {
  icon?: ReactNode;
  /** Already-translated heading, e.g. `t('dsEmptyTitle')` or a feature-specific message. */
  title: string;
  /** Already-translated supporting text. */
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** A remote-data view that loaded successfully but has nothing to show. */
export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <StatePanel
      icon={icon ?? <Inbox size={40} color={colors.text.tertiary} />}
      title={title}
      description={description}
      actionLabel={actionLabel}
      onAction={onAction}
    />
  );
}

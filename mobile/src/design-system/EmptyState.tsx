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
  /** Which font family renders the text -- this component never calls `useLanguage()` itself (see README's "Localization" section); the caller passes the active language through. */
  language?: 'en' | 'ur';
}

/** A remote-data view that loaded successfully but has nothing to show. */
export function EmptyState({ icon, title, description, actionLabel, onAction, language = 'en' }: EmptyStateProps) {
  return (
    <StatePanel
      icon={icon ?? <Inbox size={40} color={colors.text.tertiary} />}
      title={title}
      description={description}
      actionLabel={actionLabel}
      onAction={onAction}
      language={language}
    />
  );
}

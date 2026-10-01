import { ShieldAlert } from 'lucide-react-native';
import { View } from 'react-native';
import { colors } from './tokens';
import { StatePanel } from './StatePanel';

export interface ForbiddenStateProps {
  /** Already-translated heading, e.g. `t('dsForbiddenTitle')`. */
  title: string;
  /** Already-translated description, e.g. `t('dsForbiddenDescription')`. */
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Which font family renders the text -- this component never calls `useLanguage()` itself (see README's "Localization" section); the caller passes the active language through. */
  language?: 'en' | 'ur';
}

/** Full-section state for a 403/authorization failure. */
export function ForbiddenState({ title, description, actionLabel, onAction, language = 'en' }: ForbiddenStateProps) {
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <StatePanel
        icon={<ShieldAlert size={40} color={colors.danger.default} />}
        title={title}
        description={description}
        actionLabel={actionLabel}
        onAction={onAction}
        language={language}
      />
    </View>
  );
}

import { WifiOff } from 'lucide-react-native';
import { View } from 'react-native';
import { colors } from './tokens';
import { StatePanel } from './StatePanel';

export interface OfflineStateProps {
  /** Already-translated heading, e.g. `t('dsOfflineTitle')`. */
  title: string;
  /** Already-translated description, e.g. `t('dsOfflineDescription')`. */
  description?: string;
  /** Already-translated retry button label, e.g. `t('retry')`. Omit to hide the action. */
  retryLabel?: string;
  onRetry?: () => void;
  /** Which font family renders the text -- this component never calls `useLanguage()` itself (see README's "Localization" section); the caller passes the active language through. */
  language?: 'en' | 'ur';
}

/** Full-section state for a view that requires connectivity it doesn't currently have. Pair with `useOnlineStatus`. */
export function OfflineState({ title, description, retryLabel, onRetry, language = 'en' }: OfflineStateProps) {
  return (
    <View accessibilityRole="text">
      <StatePanel
        icon={<WifiOff size={40} color={colors.text.tertiary} />}
        title={title}
        description={description}
        actionLabel={retryLabel}
        onAction={onRetry}
        language={language}
      />
    </View>
  );
}

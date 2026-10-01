import { AlertCircle } from 'lucide-react-native';
import { View } from 'react-native';
import { colors } from './tokens';
import { StatePanel } from './StatePanel';

export interface ErrorStateProps {
  /** Already-translated message, e.g. `t('somethingWentWrong')`. */
  message: string;
  /** Already-translated retry button label, e.g. `t('retry')`. Omit to hide the action. */
  retryLabel?: string;
  onRetry?: () => void;
  /** Which font family renders the text -- this component never calls `useLanguage()` itself (see README's "Localization" section); the caller passes the active language through. */
  language?: 'en' | 'ur';
}

/** Full-section error state for a remote-data view that failed to load anything usable. */
export function ErrorState({ message, retryLabel, onRetry, language = 'en' }: ErrorStateProps) {
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <StatePanel
        icon={<AlertCircle size={40} color={colors.danger.default} />}
        description={message}
        actionLabel={retryLabel}
        onAction={onRetry}
        language={language}
      />
    </View>
  );
}

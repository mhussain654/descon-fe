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
}

/** Full-section error state for a remote-data view that failed to load anything usable. */
export function ErrorState({ message, retryLabel, onRetry }: ErrorStateProps) {
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <StatePanel
        icon={<AlertCircle size={40} color={colors.danger.default} />}
        description={message}
        actionLabel={retryLabel}
        onAction={onRetry}
      />
    </View>
  );
}

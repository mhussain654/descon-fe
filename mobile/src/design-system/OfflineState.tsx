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
}

/** Full-section state for a view that requires connectivity it doesn't currently have. Pair with `useOnlineStatus`. */
export function OfflineState({ title, description, retryLabel, onRetry }: OfflineStateProps) {
  return (
    <View accessibilityRole="text">
      <StatePanel
        icon={<WifiOff size={40} color={colors.text.tertiary} />}
        title={title}
        description={description}
        actionLabel={retryLabel}
        onAction={onRetry}
      />
    </View>
  );
}

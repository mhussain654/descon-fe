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
}

/** Full-section state for a 403/authorization failure. */
export function ForbiddenState({ title, description, actionLabel, onAction }: ForbiddenStateProps) {
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <StatePanel
        icon={<ShieldAlert size={40} color={colors.danger.default} />}
        title={title}
        description={description}
        actionLabel={actionLabel}
        onAction={onAction}
      />
    </View>
  );
}

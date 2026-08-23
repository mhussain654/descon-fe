import { LogIn } from 'lucide-react-native';
import { View } from 'react-native';
import { colors } from './tokens';
import { StatePanel } from './StatePanel';

export interface SessionExpiredStateProps {
  /** Already-translated heading, e.g. `t('dsSessionExpiredTitle')`. */
  title: string;
  /** Already-translated description, e.g. `t('dsSessionExpiredDescription')`. */
  description?: string;
  /** Already-translated action label, e.g. `t('dsSessionExpiredAction')`. */
  actionLabel: string;
  onAction: () => void;
}

/** Full-section state for an expired/invalidated session, prompting re-authentication. */
export function SessionExpiredState({ title, description, actionLabel, onAction }: SessionExpiredStateProps) {
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <StatePanel
        icon={<LogIn size={40} color={colors.brand.default} />}
        title={title}
        description={description}
        actionLabel={actionLabel}
        onAction={onAction}
      />
    </View>
  );
}

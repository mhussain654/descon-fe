import { AlertTriangle } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { colors, radii, spacing } from './tokens';

export interface RetryBannerProps {
  /** Already-translated message, e.g. "Showing saved data -- couldn't refresh." */
  message: string;
  /** Already-translated retry button label, e.g. `t('retry')`. */
  retryLabel: string;
  onRetry: () => void;
}

/**
 * Inline, non-blocking banner for a background refresh that failed while
 * usable cached data is still on screen. Use ErrorState instead when there
 * is no cached data to fall back to.
 */
export function RetryBanner({ message, retryLabel, onRetry }: RetryBannerProps) {
  return (
    <View style={styles.container} accessibilityRole="text">
      <View style={styles.messageRow}>
        <AlertTriangle size={16} color={colors.warning.emphasis} />
        <Text style={styles.message}>{message}</Text>
      </View>
      <Button variant="text" size="sm" onPress={onRetry}>
        {retryLabel}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    borderRadius: radii.lg,
    backgroundColor: colors.warning.subtle,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  messageRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexShrink: 1 },
  message: { flexShrink: 1, fontSize: 14, color: colors.warning.emphasis },
});

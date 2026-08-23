import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from './tokens';

export interface ProgressBarProps {
  /** 0-100. Values outside that range are clamped. */
  value: number;
  /** Already-translated accessible label, e.g. `t('mobilizationProgress')`. */
  label: string;
  /** Already-formatted display text shown under the bar, e.g. "30% complete". */
  displayText?: string;
}

/** Determinate linear progress indicator. For indeterminate loading, use Spinner instead. */
export function ProgressBar({ value, label, displayText }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <View>
      <View
        style={styles.track}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: clamped }}
      >
        <View style={[styles.fill, { width: `${clamped}%` }]} />
      </View>
      {displayText ? <Text style={styles.text}>{displayText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.surface.sunken,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radii.full, backgroundColor: colors.brand.default },
  text: { marginTop: spacing[2], fontSize: 14, color: colors.text.secondary },
});

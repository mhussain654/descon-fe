import { AlertCircle, CheckCircle2 } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from './tokens';

export type ValidationTone = 'error' | 'success';

export interface ValidationMessageProps {
  children: string;
  tone?: ValidationTone;
}

const TONE_COLOR: Record<ValidationTone, string> = {
  error: colors.danger.default,
  success: colors.success.default,
};

/** Field-level validation feedback. Pairs an icon with the text so meaning doesn't rely on color alone. */
export function ValidationMessage({ children, tone = 'error' }: ValidationMessageProps) {
  const Icon = tone === 'error' ? AlertCircle : CheckCircle2;
  const color = TONE_COLOR[tone];

  return (
    <View style={styles.row} accessibilityRole="alert">
      <Icon size={16} color={color} style={styles.icon} />
      <Text style={[styles.text, { color }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[1.5], marginTop: spacing[1.5] },
  icon: { marginTop: 2 },
  text: { flexShrink: 1, fontSize: 14 },
});
